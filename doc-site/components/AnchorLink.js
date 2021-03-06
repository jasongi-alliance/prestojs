import React from 'react';

export default function AnchorLink({ Component, children, id, className = '' }) {
    return (
        <div id={id} className={`anchor-link ${className}`}>
            <a
                className="text-gray-500 no-underline absolute anchor-link-a hover hidden"
                aria-label="Anchor"
                href={`#${id}`}
                data-anchorlink={id}
            >
                #
            </a>
            <Component>{children}</Component>
        </div>
    );
}
