# PostCSS Mixins (lite version)

<img align="right" width="135" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="https://postcss.org/logo-leftp.svg">

[PostCSS] plugin for mixins; this is a **fork** of [postcss-mixins] that strips
out all of the filesystem related functionality, and adds the optional ability
to change the rule tags used.

Note, that you must set this plugin before [postcss-simple-vars]
and [postcss-nested].

```css
@define-mixin icon $network, $color: blue {
    .icon.is-$(network) {
        color: $color;
        @mixin-content;
    }
    .icon.is-$(network):hover {
        color: white;
        background: $color;
    }
}

@mixin icon twitter {
    background: url(twt.png);
}
@mixin icon youtube, red {
    background: url(youtube.png);
}
```

```css
.icon.is-twitter {
    color: blue;
    background: url(twt.png);
}
.icon.is-twitter:hover {
    color: white;
    background: blue;
}
.icon.is-youtube {
    color: red;
    background: url(youtube.png);
}
.icon.is-youtube:hover {
    color: white;
    background: red;
}
```

[postcss-utilities] collection is better for `clearfix` and other popular hacks.
For simple cases you can use [postcss-define-property].

[postcss-define-property]: https://github.com/daleeidd/postcss-define-property
[postcss-utilities]:       https://github.com/ismamz/postcss-utilities
[postcss-simple-vars]:     https://github.com/postcss/postcss-simple-vars
[postcss-nested]:          https://github.com/postcss/postcss-nested
[postcss-mixins]:          https://github.com/postcss/postcss-mixins
[PostCSS]:                 https://github.com/postcss/postcss

<a href="https://evilmartians.com/?utm_source=postcss-mixins">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
       alt="Sponsored by Evil Martians" width="236" height="54">
</a>


## Usage

**Step 1:** Install plugin:

```sh
npm install --save-dev postcss postcss-mixins-lite
```

**Step 2:** Check your project for existed PostCSS config: `postcss.config.js`
in the project root, `"postcss"` section in `package.json`
or `postcss` in bundle config.

If you do not use PostCSS, add it according to [official docs]
and set this plugin in settings.

**Step 3:** Add the plugin to plugins list:

```diff
module.exports = {
  plugins: [
+   require('postcss-mixins-lite'),
    require('autoprefixer')
  ]
}
```


### CSS Mixin

Simple template defined directly in CSS to prevent repeating yourself.

See [postcss-simple-vars] docs for arguments syntax.

You can use it with [postcss-nested] plugin:

```css
@define-mixin icon $name {
    padding-left: 16px;
    &::after {
        content: "";
        background: url(/icons/$(name).png);
    }
}

.search {
    @mixin icon search;
}
```

Unlike Sass, PostCSS has no `if` or `while` statements. If you need some
complicated logic, you should use function mixin.


### Function Mixin

This type of mixin gives you full power of JavaScript.
You can define this mixins in `mixins` option.

This type is ideal for CSS hacks or business logic.

Also, you should use function mixin if you need to change property names
in mixin, because [postcss-simple-vars] doesn’t support variables
in properties yet.

First argument will be `@mixin` node, that called this mixin.
You can insert your declarations or rule before or after this node.
Other arguments will be taken from at-rule parameters.

See [PostCSS API](https://postcss.org/api/) about nodes API.

```js
require('postcss-mixins-lite')({
    mixins: {
        icons: function (mixin, dir) {
            fs.readdirSync('/images/' + dir).forEach(function (file) {
                var icon = file.replace(/\.svg$/, '');
                var rule = postcss.rule({ selector: '.icon.icon-' + icon });
                rule.append({
                    prop:  'background',
                    value: 'url(' + dir + '/' + file + ')'
                });
                mixin.replaceWith(rule);
            });
        }
    }
});
```

```css
@mixin icons signin;
```

```css
.icon.icon-back { background: url(signin/back.svg) }
.icon.icon-secret { background: url(signin/secret.svg) }
```

You can also return an object if you don’t want to create each node manually:

```js
require('postcss-mixins-lite')({
    mixins: {
        image: function (mixin, path, dpi) {
            return {
                '&': {
                    background: 'url(' + path + ')'
                },
                ['@media (min-resolution: '+ dpi +'dpi)']: {
                    '&': {
                        background: 'url(' + path + '@2x)'
                    }
                }
            }
        }
    }
});
```

Mixin body will be in `mixin.nodes`:

```js
var postcss = require('postcss');

require('postcss-mixins-lite')({
    mixins: {
        hover: function (mixin) {
            let rule = postcss.rule({ selector: '&:hover, &.hover' });
            rule.append(mixin.nodes);
            mixin.replaceWith(rule);
        }
    }
});
```

Or you can use object instead of function:

```js
require('postcss-mixins-lite')({
    mixins: {
        clearfix: {
            '&::after': {
                content: '""',
                display: 'table',
                clear: 'both'
            }
        }
    }
});
```

### Mixin Content

`@mixin-content` at-rule will be replaced with mixin `@mixin` children.
For example, CSS mixins:

```SCSS
@define-mixin isIE {
    .isIE & {
        @mixin-content;
    }
}
```

or JS mixins:

```js
require('postcss-mixins-lite')({
    mixins: {
        isIe: function () {
            '@mixin-content': {},
        }
    }
});
```

could be used like this:

```scss
.foo {
    color: blue;

    @mixin isIE {
        color: red;
    }
}

// output
.foo { color: blue; }
.isIE .foo { color: red; }
```

### Mixin parameters with comma

In order to pass a comma-separated value as an argument to a mixin, you can use
the special `single-arg` keyword. For example:

```css
@define-mixin transition $properties, $duration {
  transition-property: $properties;
  transition-duration: $duration;
}

.foo {
  @mixin transition single-arg(color, background-color), 0.5s;
}
```

### Migration from Sass

If you need to use Sass and PostCSS mixins together
(for example, while migration), you could set `options.tags.use` to a
value other than `mixin`. Then just put PostCSS after Sass.
An example using `{tags:{use: 'add-mixin'}}` as the options:

```sass
// Legacy SCSS
@mixin old {
    …
}
@include old;

// New code
@define-mixin new {
    …
}
@add-mixin new;
```

## Options

Call plugin function to set options:

```js
postcss([ require('postcss-mixins')({ mixins: { … } }) ])
```

### `mixins`

Type: `Object`

Object of function mixins.

### `tags`

Type: `Object`

A way to override the rule tags used by the plugin.
All the properties of this have string values, and must NOT have 
the `'@'` prefix.

### `tags.content`

Default: `'mixin-content'`

The tag for the `@` rule that can be used to include the mixin content.

### `tags.define`

Default: `'define-mixin'`

The tag for the `@` rule that is used to define a mixin from CSS.

### `tags.single`

Default: `'single-arg'`

The tag for a pseudo CSS function used for arguments that include commas.

### `tags.use`

Default: `'mixin'`

The tag for the `@` rule that is used to _use_ (include/compose) a mixin.

### `silent`

Remove unknown mixins and do not throw a error. Default is `false`.
