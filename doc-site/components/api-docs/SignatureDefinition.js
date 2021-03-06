import React from 'react';
import TypeDesc from './TypeDesc';

export default function SignatureDefinition({ name, parameters, returnType, tag = 'div' }) {
    const Tag = tag;
    return (
        <Tag>
            <span className="font-bold">{name}</span>
            <span className="signature-params">
                (
                {parameters.map((param, i) => (
                    <React.Fragment key={param.name}>
                        <span className="text-gray-600">
                            {param.flags?.isOptional && '?'}
                            {param.name}
                        </span>
                        {i < parameters.length - 1 && <span className="text-gray-400 mr-1">,</span>}
                    </React.Fragment>
                ))}
                )
            </span>
            {returnType && (
                <>
                    {' '}
                    {'=>'} <TypeDesc type={returnType} />
                </>
            )}
        </Tag>
    );
}
