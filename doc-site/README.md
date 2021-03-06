This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/zeit/next.js/tree/canary/packages/create-next-app).

## Getting Started

The dev server is started when you run `yarn dev` in the root of the project.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Writing documentation

-   New pages can be created in \_pages as required
-   Documentation is auto generated from components with a comment tag `@extract-docs`. This is extracted with the `extract-docs.js` script.
    -   See `getStaticProps.js` for where this is processed including rendering of markdown
-   You can add specific overrides if necessary (see `viewModelFactory.js` for an example)
    -   You can reference generated docs via json file created by `extract-docs.js` - see `viewModelFactory.js` for example
-   Documentation can be written as a [mdx](https://mdxjs.com/) file
    -   See `MDXProvider` in `Layout.js` for where this is controlled
        -   Note that there is also a `MDXProvider` used for autogenerated docs; this is setup in `getStaticProps.js`
-   Other comment tags you can use
    -   `@type-name MyOverride` - this replaces the type name with `MyOverride`. Useful when the typescript name is not suitable to display.
    -   `@expand-properties` - This expands each property of a type into it's own parameter on a function parameter table. If text is provided then the original name is also kept with a description matching this text. See `Form` for an example of this in use.
    -   `@hide-properties` - Use this with `@expand-properties` to hide specific properties names. Separate each name with a space.
    -   `@menu-group` - This nests this item under this menu name. If not specified appears ungrouped under the package name.
    -   `@doc-class` - Specify what documentation component class to use. If not specified defaults based on type.
    -   `@forward-ref` - Indicate this function is used as a React.forwardRef. This allows doc site renderer to not document second `ref` parameter to the function as you don't pass it in yourself.
    
### Codesandbox

To create a codesandbox example using use a codeblock with a codesandbox meta tag like: `codesandbox=./codesandbox-example/FollowerList.js`. This
will create & embed a sandbox to that file and automatically include any imported files.

**NOTE:** Name directory of files with `codesandbox-` prefix. This is only so we apply a different
layout when you preview the component locally. You can preview the component by going to the the
path for the component same as any other page (eg. if sits under `pages/docs/sandbox-example1/` go to `/docs/sandbox-example1/`).
See `_app.js` for where this logic sits.

This works using the `codesandbox` plugin for `remark` that can be found in `remark-plugins`. To add additional styles
for all examples add them to `remark-plugins/codesandbox/styles.css`.

The following options are available:

* `size=small|medium|large` - control the size of the embed (defaults to medium)
* `highlight=1,5-10` - highlight lines in editor (eg. example here highlights line 1 and lines 5 through 10)
* `view=editor|split|preview` - which view to open by default (defaults to preview)
* `hidenavigation=0` - hide the navigation bar of preview (defaults to 0)
* `editorsize=20` - size in percentage of editor (defaults to 50)
    
## Deployment

Currently deploying to netlify as now no longer lets you connect a personal account to an organization github account.

Deploys happen automatically on push.

We use the `next export` feature to generate a static build.

