from allianceutils.auth.models import GenericUserProfile
from allianceutils.auth.models import GenericUserProfileManagerMixin
from authtools.models import AbstractEmailUser
from authtools.models import UserManager
from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.db import models
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import camel_case_to_spaces

USER_ACTIVATION_TOKEN_SALT = "xenopus_frog:activation-salt"
PASSWORD_RESET_TOKEN_SALT = "xenopus_frog:password-reset-salt"


class UserManager(GenericUserProfileManagerMixin, UserManager):
    pass


class User(GenericUserProfile, AbstractEmailUser):
    objects = UserManager()
    profiles = UserManager(select_related_profiles=True)
    # Used in CSV permission to identify which permissions apply. This should be set on subclasses.
    user_type = None

    related_profile_tables = [
        "customerprofile",
        "adminprofile",
    ]

    first_name = models.CharField(max_length=128, blank=True)
    last_name = models.CharField(max_length=128, blank=True)
    email = models.EmailField(unique=True)

    REGION_CHOICES = [
        [1, "Oceania"],
        [2, "Asia"],
        [3, "Africa"],
        [4, "America"],
        [5, "Europe"],
        [6, "Antarctica"],
        [7, "Atlantis"],
    ]

    region = models.IntegerField(null=True, blank=True, choices=REGION_CHOICES)

    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "xenopus_frog_user"

    def __str__(self):
        return self.email

    @classmethod
    def get_user_types(cls):
        types = []
        for profile_model in cls.related_profile_tables:
            try:
                types.append(
                    getattr(cls, profile_model).related.related_model.user_type
                )
            except AttributeError:
                pass
        return types

    @classmethod
    def get_user_type_choices(cls):
        choices = []
        for type in cls.get_user_types():
            choices.append((type, camel_case_to_spaces(type).capitalize()))
        return choices

    def activate(self):
        self.activated_at = timezone.localtime()
        self.is_active = True
        self.save()

    def was_activated(self):
        return self.activated_at is not None

    def generate_activation_token(self) -> str:
        """Generate a time-stamped token for use in activation url"""
        return signing.dumps(
            {
                "id": self.id,
                "email": self.email,
            },
            salt=USER_ACTIVATION_TOKEN_SALT,
        )

    def generate_password_reset_token(self) -> str:
        """Generate a token based on the current password for use in password reset url"""
        return signing.dumps(
            {
                "id": self.id,
                "email": self.email,
                "password": self.password,
            },
            key=settings.PASSWORD_RESET_TOKEN_KEY,
            salt=PASSWORD_RESET_TOKEN_SALT,
            compress=True,
        )

    @staticmethod
    def get_user_from_activation_token(token: str, max_age: int = None) -> "User":
        """
        Check that an activation token is valid, and if so, return corresponding user record.
        :param token: base64 encoded string generated by generate_activation_token
        :param max_age: max age of token in seconds
        :return: the User record
        :raises: BadSignature if token is invalid or User record is not found
                 SignatureExpired if token is too old
        """
        if max_age is None:
            max_age = settings.USER_ACTIVATION_TOKEN_MAX_AGE_DAYS * 24 * 3600
        try:
            data = signing.loads(
                token, salt=USER_ACTIVATION_TOKEN_SALT, max_age=max_age
            )
            user_id, user_email = data["id"], data["email"]
            return User.objects.get(id=user_id, email__iexact=user_email)
        except signing.SignatureExpired:
            raise
        except signing.BadSignature:
            raise
        except User.DoesNotExist:
            raise signing.BadSignature("User record not found")

    @staticmethod
    def get_user_from_password_reset_token(token: str) -> "User":
        """
        Check that an activation token is valid and return the corresponding user record if it is.
        :param token: signed base64 encoded token
        :return: the User record
        :raises: BadSignature if the token is invalid or the User record is not found
                 SignatureExpired if the signature is more than a day old
        """
        max_age = settings.PASSWORD_RESET_TOKEN_MAX_AGE_DAYS * 24 * 3600
        try:
            data = signing.loads(
                token,
                key=settings.PASSWORD_RESET_TOKEN_KEY,
                salt=PASSWORD_RESET_TOKEN_SALT,
                max_age=max_age,
            )
            user_id, user_email, user_password = (
                data["id"],
                data["email"],
                data["password"],
            )
            return User.objects.get(
                id=user_id, email__iexact=user_email, password__iexact=user_password
            )
        except signing.SignatureExpired:
            raise
        except signing.BadSignature:
            raise
        except User.DoesNotExist:
            raise signing.BadSignature("Invalid Token")

    def send_activation_email(
        self, request, is_new_user: bool = False, is_resend: bool = False
    ):
        """
        Send the new user activation email, containing an activation link.
        :param request: http request object
        :param is_new_user: True if this is a new user, False if user already existed
        :param is_resend: True if this is an existing user requesting another link (e.g. previous
        link may have expired)
        :raises SMTPException if sending fails
        """
        token = self.generate_activation_token()
        email_subject = "Activate your account"
        email_body = render_to_string(
            "email/user_signup_activation.html",
            context={
                "user": self,
                "is_new_user": is_new_user,
                "activation_url": request.build_absolute_uri(
                    "/app/activate/%s/" % token
                ),
                "link_expiry_days": settings.USER_ACTIVATION_TOKEN_MAX_AGE_DAYS,
            },
        )
        send_mail(
            email_subject,
            "",
            settings.SERVER_EMAIL,
            [self.email],
            html_message=email_body,
        )

    def send_password_reset_email(self, request):
        """
        Send the password reset email including the password reset link.
        :param request: http request object
        :raises SMTPException if sending fails for whatever reason
        """
        token = self.generate_password_reset_token()
        email_subject = "Reset your password"
        email_body = render_to_string(
            "email/password_reset.html",
            context={
                "reset_url": request.build_absolute_uri(
                    f"/app/reset_password/?token={token}"
                )
            },
        )
        send_mail(
            email_subject,
            "",
            settings.SERVER_EMAIL,
            [self.email],
            html_message=email_body,
        )


class AdminProfile(User):
    # TEMPLATEFIXME: other admin profile fields go here
    # extra_details = models.CharField(max_length=100)

    user_type = "admin"

    class Meta:
        db_table = "xenopus_frog_admin_profile"
        manager_inheritance_from_future = True


class CustomerProfile(User):
    # TEMPLATEFIXME: other customer profile fields go here
    # extra_details = models.CharField(max_length=100)

    user_type = "customer"

    class Meta:
        db_table = "xenopus_frog_customer_profile"
        manager_inheritance_from_future = True
