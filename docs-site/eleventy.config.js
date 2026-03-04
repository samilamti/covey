import fs from 'fs'

const LANGUAGES = ['sv', 'nb', 'da', 'fi', 'ar', 'is', 'pl', 'fo', 'kl', 'se', 'uk', 'en']

let navCache = null
function getNav() {
  if (!navCache) {
    navCache = JSON.parse(fs.readFileSync('src/_data/navigation.json', 'utf-8'))
  }
  return navCache
}

let navLabelsCache = null
function getNavLabels() {
  if (!navLabelsCache) {
    navLabelsCache = JSON.parse(fs.readFileSync('src/_data/navLabels.json', 'utf-8'))
  }
  return navLabelsCache
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets')

  // Invalidate caches on watch
  eleventyConfig.on('eleventy.before', () => {
    navCache = null
    navLabelsCache = null
  })

  // Create a collection per language for navigation
  for (const lang of LANGUAGES) {
    eleventyConfig.addCollection(lang, (collection) =>
      collection
        .getFilteredByGlob(`src/${lang}/**/*.md`)
        .sort((a, b) => (a.data.order || 99) - (b.data.order || 99))
    )
  }

  // Filter: resolve the URL for a page in another language
  eleventyConfig.addFilter('localizedUrl', function (pageId, targetLang) {
    const nav = getNav()
    const entry = nav.pages.find((p) => p.pageId === pageId)
    if (!entry) return `/${targetLang}/`
    const slug = entry.slugs[targetLang] || entry.slugs['sv'] || ''
    return slug ? `/${targetLang}/${slug}/` : `/${targetLang}/`
  })

  // Filter: get the localized nav label for a pageId
  eleventyConfig.addFilter('localizedNavLabel', function (pageId, lang) {
    const labels = getNavLabels()
    const entry = labels[pageId]
    if (!entry) return pageId
    return entry[lang] || entry['sv'] || pageId
  })

  // Date filter for footer copyright
  eleventyConfig.addFilter('date', function (value, format) {
    if (format === '%Y') return new Date().getFullYear()
    return value
  })

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      data: '_data',
    },
    markdownTemplateEngine: 'njk',
  }
}
