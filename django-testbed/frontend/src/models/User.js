/* eslint-disable no-use-before-define,@typescript-eslint/no-use-before-define */
import { Endpoint } from '@xenopus/rest';
import { NumberField } from '@xenopus/viewmodel';

import namedUrls from '../namedUrls';

import BaseUser from './generated/BaseUser';

function transformAndCacheUser(data) {
    if (Array.isArray(data)) {
        const users = data.map(datum => new User(datum));
        User.cache.addList(users);
        return users;
    }
    const user = new User(data);
    User.cache.add(user);
    return user;
}

export default class User extends BaseUser {
    // TODO: Not sure if we want this to be the convention. Maybe best to just
    // export as mapping of endpoints somewhere?
    static endpoints = {
        retrieve: new Endpoint(namedUrls.get('users-detail'), {
            transformResponseBody: transformAndCacheUser,
        }),
        update: new Endpoint(namedUrls.get('users-detail'), {
            transformResponseBody: transformAndCacheUser,
            method: 'patch',
        }),
        list: new Endpoint(namedUrls.get('users-list'), {
            transformResponseBody: transformAndCacheUser,
        }),
        create: new Endpoint(namedUrls.get('users-list'), {
            transformResponseBody: transformAndCacheUser,
            method: 'post',
        }),
    };

    static fields = {
        ...BaseUser.fields,
        age: new NumberField({
            name: 'age',
            label: 'Age',
            required: true,
            helpText: 'Users age in years',
        }),
    };
}

window.User = User;
