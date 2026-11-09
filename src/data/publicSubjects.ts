export interface PublicSubject {
  id: string
  name: string
  department: string | null
  instructor: {
    name: string
    position: string
  }
  assessment: {
    type: 'Экзамен' | 'Зачет'
    format: string
    source: string
  }
  courseInfo: readonly {
    text: string
    source: string
    caution?: string
  }[]
  portalUrl: string | null
  links: readonly {
    title: string
    url: string
  }[]
  comments: readonly string[]
}

export const preliminarySchedule = [
  {
    date: '19 ноября 2026',
    kind: 'Зачеты',
    detail: 'Утром, возможное начало в 9:00 или 9:30',
  },
  {
    date: '20 ноября 2026',
    kind: 'Зачеты',
    detail: 'Утром, возможное начало в 9:00 или 9:30',
  },
  {
    date: '21 ноября 2026',
    kind: 'Зачеты',
    detail: 'Утром, возможное начало в 9:00 или 9:30',
  },
  {
    date: '5 декабря 2026',
    kind: 'Экзамены',
    detail: 'Планируются у двух групп, предметы и время неизвестны',
  },
] as const

export const publicSubjects: readonly PublicSubject[] = [
  {
    id: 'private-international-law',
    name: 'Международное частное право',
    department: 'Кафедра гражданского права',
    instructor: { name: 'Цегельник О. В.', position: 'доцент' },
    assessment: {
      type: 'Экзамен',
      format: 'Устный',
      source: 'Учебная заметка о сессии',
    },
    courseInfo: [
      {
        text: 'Преподаватель сообщила об обновленном списке из 75 экзаменационных вопросов, плане первого занятия и методических материалах.',
        source: 'Сообщение преподавателя и материалы курса 2026-2027',
      },
      {
        text: 'Первое занятие охватывает источники международного частного права, коллизионные нормы и применение иностранного права.',
        source: 'План занятия 1',
      },
    ],
    portalUrl: 'https://edulaw.bsu.by/course/view.php?id=1091',
    links: [],
    comments: [],
  },
  {
    id: 'agrarian-law',
    name: 'Аграрное право',
    department: 'Кафедра экологического и аграрного права',
    instructor: { name: 'Кузьмич И. П.', position: 'доцент' },
    assessment: {
      type: 'Экзамен',
      format: 'Формат не уточнен',
      source: 'Формат в материалах курса не указан',
    },
    courseInfo: [
      {
        text: 'Среди предоставленных материалов: программа, план семинаров, основной и дополнительный списки экзаменационных вопросов, учебные материалы и нормативные тексты.',
        source: 'Предоставленные материалы курса',
      },
      {
        text: 'План семинаров помечен 2025-2026 учебным годом, его применимость к текущему курсу следует уточнить. Актуальность переданных редакций нормативных текстов не подтверждена.',
        source: 'Примечание к материалам курса',
        caution: 'Требует сверки с актуальными указаниями преподавателя',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
  {
    id: 'criminal-procedure',
    name: 'Уголовный процесс',
    department: 'Кафедра уголовного процесса и прокурорского надзора',
    instructor: { name: 'Рыбак С. В.', position: 'доцент' },
    assessment: {
      type: 'Экзамен',
      format: 'Формат не уточнен',
      source: 'Учебная заметка, требует подтверждения',
    },
    courseInfo: [
      {
        text: 'В доступной заметке указано, что экзамен может быть устным или в форме теста. Формат и список экзаменационных вопросов требуют подтверждения.',
        source: 'Учебная заметка, не подтверждено преподавателем',
        caution: 'Формат не подтвержден',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
  {
    id: 'family-law',
    name: 'Семейное право',
    department: 'Кафедра гражданского права',
    instructor: { name: 'Короткевич М. П.', position: 'доцент' },
    assessment: {
      type: 'Экзамен',
      format: 'Формат не уточнен',
      source: 'Учебная заметка',
    },
    courseInfo: [
      {
        text: 'Семинарские материалы указаны как размещенные на образовательном портале. Список экзаменационных вопросов в доступных материалах не найден.',
        source: 'Учебная заметка',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
  {
    id: 'forensics',
    name: 'Криминалистика',
    department: 'Кафедра криминалистики',
    instructor: { name: 'Лапина И. А.', position: 'доцент' },
    assessment: {
      type: 'Зачет',
      format: 'Формат не уточнен',
      source: 'Учебная заметка, требует уточнения',
    },
    courseInfo: [
      {
        text: 'Требования, формат зачета и материалы курса в доступной информации не уточнены.',
        source: 'Сведения требуют уточнения',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
  {
    id: 'property-law',
    name: 'Право собственности и другие вещные права',
    department: null,
    instructor: { name: 'Реуцкая Е. А.', position: 'старший преподаватель' },
    assessment: {
      type: 'Зачет',
      format: 'Формат не уточнен',
      source: 'Учебная заметка, требования не указаны',
    },
    courseInfo: [
      {
        text: 'Общие требования и материалы курса в доступной информации не уточнены.',
        source: 'Сведения требуют уточнения',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
  {
    id: 'investment-law',
    name: 'Инвестиционное право',
    department: 'Кафедра хозяйственного права',
    instructor: { name: 'Куницкая О. М.', position: 'доцент' },
    assessment: {
      type: 'Зачет',
      format: 'Тест на образовательном портале',
      source: 'Учебная заметка',
    },
    courseInfo: [
      {
        text: 'В заметке о курсе сказано, что промежуточный тест из 25 вопросов похож на зачетный. Это сходство не подтверждено преподавателем.',
        source: 'Учебная заметка',
        caution: 'Считать ориентиром, а не утвержденным форматом',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
  {
    id: 'antitrust-law',
    name: 'Антимонопольное право',
    department: 'Кафедра хозяйственного права',
    instructor: { name: 'Гавриленко А. В.', position: 'старший преподаватель' },
    assessment: {
      type: 'Зачет',
      format: 'Формат не уточнен',
      source: 'Учебная заметка',
    },
    courseInfo: [
      {
        text: 'Ожидаются материалы учебно-методического комплекса. Имеющиеся страницы МАРТ являются дополнительными справочными материалами, их соответствие программе курса не подтверждено.',
        source: 'Карта материалов курса',
      },
    ],
    portalUrl: null,
    links: [
      {
        title: 'Антимонопольное регулирование и конкуренция, МАРТ',
        url: 'https://www.mart.gov.by/activity/antimonopolnoe-regulirovanie-i-konkurentsiya/',
      },
      {
        title: 'Комиссия по рассмотрению нарушений, МАРТ',
        url: 'https://www.mart.gov.by/activity/antimonopolnoe-regulirovanie-i-konkurentsiya/komissiya-po-ustanovleniyu-fakta-nalichiya-otsutstviya-narusheniya-antimonopolnogo-zakonodatelstva/',
      },
    ],
    comments: [],
  },
  {
    id: 'criminology',
    name: 'Криминология',
    department: 'Кафедра уголовного права',
    instructor: { name: 'Городецкая М. А.', position: 'доцент' },
    assessment: {
      type: 'Экзамен',
      format: 'Тест, 20 вопросов',
      source: 'Учебная заметка, не подтверждено преподавателем',
    },
    courseInfo: [
      {
        text: 'В учебной заметке рекомендованы Закон № 122-З «Об основах деятельности по профилактике правонарушений» и тесты из пособия. Пособие и тесты курса среди переданных материалов не найдены.',
        source: 'Учебная заметка, требования преподавателя не подтверждены',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
  {
    id: 'intellectual-property',
    name: 'Право интеллектуальной собственности',
    department: 'Кафедра права интеллектуальной собственности',
    instructor: { name: 'Сидорчук В. К.', position: 'доцент' },
    assessment: {
      type: 'Зачет',
      format: 'Формат не уточнен',
      source: 'Учебная заметка, требует уточнения',
    },
    courseInfo: [
      {
        text: 'В материалах есть список из 39 вопросов, но он предназначен для студентов дневного отделения 2-го курса 2024-2025 учебного года. Его актуальность для этого курса не подтверждена.',
        source: 'Предоставленный список вопросов',
        caution: 'Не считать актуальной программой курса без подтверждения',
      },
    ],
    portalUrl: null,
    links: [],
    comments: [],
  },
]
