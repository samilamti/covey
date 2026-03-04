import { useTranslation } from 'react-i18next'

export function BetaBanner() {
  const { t } = useTranslation()

  return (
    <div class="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900">
      <span>{t('beta.notice')}</span>
      {' '}
      <a href="mailto:beta-feedback@covey.se" class="underline font-medium hover:text-amber-950">
        {t('beta.feedback')}
      </a>
    </div>
  )
}
