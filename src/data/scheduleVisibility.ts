export type StudyGroup = 'ОБЩ' | 'СПС' | 'ХОЗ'

export function isScheduleEventVisible(group: string | undefined, selectedGroup: StudyGroup) {
  if (selectedGroup === 'ОБЩ') return true

  const normalizedGroup = (group ?? '').trim().toLocaleUpperCase('ru')
  if (!normalizedGroup || normalizedGroup.includes('ОБЩ')) return true

  const groupAliases = selectedGroup === 'СПС'
    ? ['СПС', 'СУДЕБНО-ПРОКУРОРСКО-СЛЕДСТВЕННАЯ ДЕЯТЕЛЬНОСТЬ']
    : ['ХОЗ', 'ХОЗЯЙСТВЕННОЕ ПРАВО']

  return groupAliases.some((alias) => normalizedGroup.includes(alias))
}
