const { parse } = require('postcss-js')
const vars = require('postcss-simple-vars')

const DEF_TAGS =
{
  content: 'mixin-content',
  define:  'define-mixin',
  single:  'single-arg',
  use:     'mixin',
}

function addMixin(helpers, mixins, rule, tags) {
  let name = rule.params.split(/\s/, 1)[0]
  let other = rule.params.slice(name.length).trim()

  let args = []
  if (other.length) {
    args = helpers.list.comma(other).map(str => {
      let arg = str.split(':', 1)[0]
      let defaults = str.slice(arg.length + 1)
      return [arg.slice(1).trim(), defaults.trim()]
    })
  }

  let content = false
  rule.walkAtRules(tags.content, () => {
    content = true
    return false
  })

  mixins[name] = { args, content, mixin: rule }

  rule.remove()
}

function processMixinContent(rule, from, tags) {
  rule.walkAtRules(tags.content, content => {
    if (from.nodes && from.nodes.length > 0) {
      content.replaceWith(from.clone().nodes)
    } else {
      content.remove()
    }
  })
}

function insertObject(rule, obj, singeArgumentsMap, tags) {
  let root = parse(obj)
  root.each(node => {
    node.source = rule.source
  })
  processMixinContent(root, rule, tags)
  unwrapSingleArguments(root.nodes, singeArgumentsMap, tags)
  rule.parent.insertBefore(rule, root)
}

function unwrapSingleArguments(rules, singleArgumentsMap, tags) {
  if (singleArgumentsMap.size <= 0) {
    return
  }

  for (let rule of rules) {
    if (rule.type === 'decl') {
      if (rule.value.includes(tags.single)) {
        let newValue = rule.value
        for (let [key, value] of singleArgumentsMap) {
          newValue = newValue.replace(key, value)
        }
        rule.value = newValue
      }
    } else if (rule.type === 'rule') {
      unwrapSingleArguments(rule.nodes, singleArgumentsMap, tags)
    }
  }
}

function resolveSingleArgumentValue(value, parentNode, tags) {
  let content = value.slice(tags.single.length).trim()

  if (!content.startsWith('(') || !content.endsWith(')')) {
    throw parentNode.error(
      'Content of single-arg must be wrapped in brackets: ' + value
    )
  }

  return content.slice(1, -1)
}

function insertMixin(helpers, mixins, rule, opts) {
  let {tags} = opts;
  let name = rule.params.split(/\s/, 1)[0]
  let rest = rule.params.slice(name.length).trim()

  if (name.includes('(')) {
    throw rule.error(
      'Remove brackets from mixin. Like: @mixin name(1px) → @mixin name 1px'
    )
  }

  let params
  if (rest.trim() === '') {
    params = []
  } else {
    params = helpers.list.comma(rest)
  }

  let meta = mixins[name]
  let mixin = meta && meta.mixin
  let singleArgumentsMap = new Map(
    params
      .filter(param => param.startsWith(tags.single))
      .map(param => [param, resolveSingleArgumentValue(param, rule, tags)])
  )

  if (!meta) {
    if (!opts.silent) {
      throw rule.error('Undefined mixin ' + name)
    }
  } else if (mixin.name === tags.define) {
    let i
    let values = {}
    for (i = 0; i < meta.args.length; i++) {
      values[meta.args[i][0]] = params[i] || meta.args[i][1]
    }

    let proxy = new helpers.Root()
    for (i = 0; i < mixin.nodes.length; i++) {
      let node = mixin.nodes[i].clone()
      delete node.raws.before
      proxy.append(node)
    }

    if (meta.args.length) {
      proxy = helpers.postcss([vars({ only: values })]).process(proxy).root
    }

    if (meta.content) processMixinContent(proxy, rule, tags)

    unwrapSingleArguments(proxy.nodes, singleArgumentsMap, tags)

    rule.parent.insertBefore(rule, proxy)
  } else if (typeof mixin === 'object') {
    insertObject(rule, mixin, singleArgumentsMap, tags)
  } else if (typeof mixin === 'function') {
    let args = [rule].concat(params)
    rule.walkAtRules(atRule => {
      if (atRule.name === tags.use) {
        insertMixin(helpers, mixins, atRule, opts)
      }
    })
    let nodes = mixin(...args)
    if (typeof nodes === 'object') {
      insertObject(rule, nodes, singleArgumentsMap, tags)
    }
  } else {
    throw new Error('Wrong ' + name + ' mixin type ' + typeof mixin)
  }

  if (rule.parent) rule.remove()
}

module.exports = (opts = {}) => {
  let tags = Object.assign({}, DEF_TAGS, opts.tags);
  opts.tags = tags;
  return {
    postcssPlugin: 'postcss-mixins-lite',

    prepare() {
      let mixins = {}

      if (typeof opts.mixins === 'object') {
        for (let i in opts.mixins) {
          mixins[i] = { mixin: opts.mixins[i] }
        }
      }

      return {
        AtRule: {
          [tags.define]: (node, helpers) => {
            addMixin(helpers, mixins, node, tags)
            node.remove()
          },
          [tags.use]: (node, helpers) => {
            insertMixin(helpers, mixins, node, opts)
          }
        },
      }
    }
  }
}
module.exports.postcss = true
