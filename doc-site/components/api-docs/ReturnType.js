import React from 'react';
import { expandProperties } from '../../util';
import MdxWrapper from './MdxWrapper';
import ParameterTable from './ParameterTable';
import TypeDesc from './TypeDesc';

export default function ReturnType({ signature }) {
    const returnTypes = [];
    const type = signature.type.referencedType?.().type || signature.type;
    if (type.type === 'union') {
        const types = type.types;
        console.log('heh', types);
        returnTypes.push(...types.map(t => [t, expandProperties(t, true)?.[1] || []]));
    } else {
        const [, c] = (signature.type && expandProperties(signature.type, true)) || [];
        returnTypes.push([signature.type, c]);
    }
    return (
        <div className="mt-5">
            <h3>Returns</h3>
            {returnTypes.length > 1 && <p className="my-5">One of the following:</p>}
            {returnTypes.map(([type, c], i) => {
                let isConstructor = false;
                if (c) {
                    // Don't expand properties for these... kind of weird when this happens when
                    // the returned value is a class
                    isConstructor = c.filter(({ name }) => name === 'constructor').length > 0;
                }
                return (
                    <React.Fragment key={i}>
                        <TypeDesc type={type} />
                        {!isConstructor && c && (
                            <ParameterTable parameters={c} nameHeader="Key" isReturnType />
                        )}
                        {i !== returnTypes.length - 1 && <p className="my-10 text-center">OR</p>}
                    </React.Fragment>
                );
            })}
            {signature.mdxReturns && <MdxWrapper mdx={signature.mdxReturns} />}
        </div>
    );
}
