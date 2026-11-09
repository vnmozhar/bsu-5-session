import { useMemo, useState } from 'react'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CalendarOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LinkOutlined,
  MessageOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Card,
  Col,
  ConfigProvider,
  Empty,
  Input,
  Row,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import {
  departmentContacts,
  facultyContacts,
  officialSchedule,
  preliminarySchedule,
  publicSubjects,
  sessionRange,
} from './data/publicSubjects'
import './App.css'

const { Paragraph, Text, Title } = Typography
const weekdayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

interface CalendarEvent {
  date: string
  kind: string
  detail: string
}

function parseScheduleDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toLocalISODate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

const today = toLocalISODate(new Date())

function formatScheduleDate(date: string) {
  return parseScheduleDate(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getSessionMonthKeys() {
  const start = parseScheduleDate(sessionRange.start)
  const end = parseScheduleDate(sessionRange.end)
  const months: string[] = []

  for (
    const month = new Date(start.getFullYear(), start.getMonth(), 1);
    month <= end;
    month.setMonth(month.getMonth() + 1)
  ) {
    months.push(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`)
  }

  return months
}

function CalendarGrid({
  events,
  selectedDate,
  onSelectDate,
}: {
  events: readonly CalendarEvent[]
  selectedDate: string
  onSelectDate: (date: string) => void
}) {
  const months = getSessionMonthKeys().map((monthKey) => {
    const [year, month] = monthKey.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const dayCount = new Date(year, month, 0).getDate()

    return {
      key: monthKey,
      title: firstDay.toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      }),
      days: [
        ...Array.from({ length: startOffset }, () => null),
        ...Array.from({ length: dayCount }, (_, index) => index + 1),
      ],
    }
  })

  return (
    <div className="calendar-months">
      {months.map((month) => (
        <section
          aria-label={`Календарь: ${month.title}`}
          className="calendar-month"
          key={month.key}
        >
          <Title level={3}>{month.title}</Title>
          <div className="calendar-grid calendar-weekdays">
            {weekdayLabels.map((weekday) => (
              <Text key={weekday}>{weekday}</Text>
            ))}
          </div>
          <div className="calendar-grid calendar-days">
            {month.days.map((day, index) => {
              if (day === null) {
                return <span aria-hidden="true" key={`blank-${index}`} />
              }

              const date = `${month.key}-${String(day).padStart(2, '0')}`
              if (date < sessionRange.start || date > sessionRange.end) {
                return <span aria-hidden="true" key={date} />
              }

              const dayEvents = events.filter((event) => event.date === date)

              return dayEvents.length > 0 ? (
                <button
                  aria-label={`${formatScheduleDate(date)}: ${dayEvents.map((event) => event.kind).join(', ')}`}
                  aria-pressed={selectedDate === date}
                  className={`calendar-day calendar-event-day${selectedDate === date ? ' is-selected' : ''}`}
                  key={date}
                  onClick={() => onSelectDate(date)}
                  title={dayEvents.map((event) => event.detail).join('; ')}
                  type="button"
                >
                  <span>{day}</span>
                  <span className="calendar-event-marker" />
                </button>
              ) : (
                <span className="calendar-day" key={date}>
                  {day}
                </span>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'
  const isSubjectPath = currentPath.startsWith('/subjects/')
  const isSchedulePath = currentPath === '/schedule'
  const selectedSubject = publicSubjects.find(
    (subject) => currentPath === `/subjects/${subject.id}`,
  )
  const hasOfficialSchedule = officialSchedule.length > 0
  const calendarEvents = hasOfficialSchedule
    ? officialSchedule.map((event) => ({
        date: event.date,
        kind: event.kind,
        detail: `${event.time} · ${event.subject} · ${event.group} · ${event.location}`,
      }))
    : preliminarySchedule
  const sortedCalendarEvents = [...calendarEvents].sort((first, second) =>
    first.date.localeCompare(second.date),
  )
  const upcomingEvents = sortedCalendarEvents
    .filter((event) => event.date >= today)
    .slice(0, 5)
  const [selectedDate, setSelectedDate] = useState(
    upcomingEvents[0]?.date ?? sortedCalendarEvents[0]?.date ?? '',
  )
  const selectedEvents = calendarEvents.filter(
    (event) => event.date === selectedDate,
  )
  const subjectSchedule = selectedSubject
    ? officialSchedule.filter((event) => event.subjectId === selectedSubject.id)
    : []
  const subjectCalendarEvents: CalendarEvent[] = subjectSchedule.map((event) => ({
    date: event.date,
    kind: event.kind,
    detail: `${event.time} · ${event.subject}`,
  }))
  const [selectedSubjectDate, setSelectedSubjectDate] = useState(
    subjectSchedule[0]?.date ?? '',
  )
  const selectedSubjectEvents = subjectSchedule.filter(
    (event) => event.date === selectedSubjectDate,
  )
  const examSubjects = publicSubjects.filter(
    (subject) => subject.assessment.type === 'Экзамен',
  )
  const creditSubjects = publicSubjects.filter(
    (subject) => subject.assessment.type === 'Зачет',
  )
  const courseworkDepartments = Array.from(
    publicSubjects.reduce<Map<string, typeof publicSubjects[number][]>>((departments, subject) => {
      if (subject.department) {
        const subjects = departments.get(subject.department) ?? []
        subjects.push(subject)
        departments.set(subject.department, subjects)
      }

      return departments
    }, new Map()),
    ([department, subjects]) => ({ department, subjects }),
  )
  const controlWorkSubjects = publicSubjects.filter(
    (subject) => subject.controlWork,
  )

  const filteredSubjects = useMemo(
    () =>
      publicSubjects.filter((subject) =>
        [
          subject.name,
          subject.department ?? '',
          subject.instructor.name,
          subject.instructor.position,
          subject.assessment.type,
          subject.assessment.format,
          ...subject.courseInfo.map((item) => item.text),
          ...subject.requirements.map((item) => item.text),
          ...subject.topicGroups.flatMap((item) => [item.title, item.detail]),
          ...subject.topicItems,
          ...(subject.materials ?? []).map((item) => item.title),
          ...subject.analysis,
        ].some((value) => value.toLocaleLowerCase('ru').includes(normalizedQuery)),
      ),
    [normalizedQuery],
  )

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#285a47',
          colorText: '#1e3028',
          colorTextSecondary: '#65736c',
          colorBgLayout: '#f5f6f2',
          colorBorderSecondary: '#e8ece6',
          borderRadius: 16,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <main className="dashboard">
        {!isSubjectPath && !isSchedulePath && <section className="hero">
          <div className="hero-content">
            <Tag className="eyebrow">
              <BookOutlined /> Учебная навигация
            </Tag>
            <Title level={1}>Учебная сессия</Title>
            <Paragraph className="hero-description">
              Предварительные даты, форматы аттестации и сведения о требованиях
              по предметам. Для каждого указаны источники информации и то, что
              еще нужно подтвердить.
            </Paragraph>
            <div className="hero-meta">
              <span className="hero-dot" />
              <Text>Публичная информация о дисциплинах</Text>
            </div>
          </div>
          <div className="hero-mark" aria-hidden="true">
            <BookOutlined />
          </div>
        </section>}

        {!isSubjectPath && !isSchedulePath && (
          <section className="schedule-panel" aria-labelledby="schedule-title">
            <div className="schedule-heading">
              <div className="schedule-title-wrap">
                <span className="schedule-icon">
                  <CalendarOutlined />
                </span>
                <div>
                  <Text className="section-kicker">СЕССИЯ 5 · ОСЕНЬ 2026</Text>
                  <Title id="schedule-title" level={2}>
                    Календарь сессии
                  </Title>
                </div>
              </div>
              <div className="schedule-actions">
                <Tag color={hasOfficialSchedule ? 'green' : 'gold'}>
                  {hasOfficialSchedule ? 'Опубликовано' : 'Предварительно'}
                </Tag>
                <a className="schedule-full-link" href="/schedule">
                  Открыть календарь сессии <ArrowRightOutlined />
                </a>
              </div>
            </div>
            <Alert
              className="schedule-alert"
              title={
                hasOfficialSchedule
                  ? 'Официальное расписание опубликовано'
                  : 'Расписание пока согласуется'
              }
              description={
                hasOfficialSchedule
                  ? 'Календарь показывает даты занятий. Откройте полное расписание, чтобы посмотреть время, предметы, группы и аудитории.'
                  : 'Пока известны только предварительные даты. Предметы, группы и время еще не подтверждены.'
              }
              showIcon
              type={hasOfficialSchedule ? 'success' : 'warning'}
            />
            <Text className="session-range">
              Сессия 5 (осень 2026): с {formatScheduleDate(sessionRange.start)} по{' '}
              {formatScheduleDate(sessionRange.end)}
            </Text>
            <div className="calendar-layout">
              <CalendarGrid
                events={calendarEvents}
                onSelectDate={setSelectedDate}
                selectedDate={selectedDate}
              />
              <aside aria-live="polite" className="calendar-selection">
                <Text className="section-kicker">ВЫБРАННАЯ ДАТА</Text>
                {selectedDate ? (
                  <>
                    <Title level={3}>{formatScheduleDate(selectedDate)}</Title>
                    {selectedEvents.map((event) => (
                      <div className="calendar-event-detail" key={`${event.date}-${event.kind}-${event.detail}`}>
                        <Text className="schedule-date-kind">{event.kind}</Text>
                        <Text className="schedule-date-detail">{event.detail}</Text>
                      </div>
                    ))}
                  </>
                ) : (
                  <Text>Даты пока не указаны</Text>
                )}
              </aside>
            </div>
            <section aria-labelledby="upcoming-events-title" className="upcoming-events">
              <div className="upcoming-events-heading">
                <div>
                  <Text className="section-kicker">БЛИЖАЙШИЕ ДАТЫ</Text>
                  <Title id="upcoming-events-title" level={3}>
                    До пяти следующих событий
                  </Title>
                </div>
                <Text type="secondary">Выберите событие, чтобы увидеть его в календаре</Text>
              </div>
              {upcomingEvents.length > 0 ? (
                <div className="upcoming-events-list">
                  {upcomingEvents.map((event) => (
                    <button
                      aria-pressed={selectedDate === event.date}
                      className={`upcoming-event${selectedDate === event.date ? ' is-selected' : ''}`}
                      key={`${event.date}-${event.kind}-${event.detail}`}
                      onClick={() => setSelectedDate(event.date)}
                      type="button"
                    >
                      <Text className="upcoming-event-date">
                        {formatScheduleDate(event.date)}
                      </Text>
                      <Text className="schedule-date-kind">{event.kind}</Text>
                      <Text className="schedule-date-detail">{event.detail}</Text>
                    </button>
                  ))}
                </div>
              ) : (
                <Text className="empty-detail">Ближайших событий нет</Text>
              )}
            </section>
          </section>
        )}

        {!isSubjectPath && !isSchedulePath && (
          <section
            aria-labelledby="session-overview-title"
            className="session-overview"
          >
            <div className="session-overview-heading">
              <Text className="section-kicker">СЕССИЯ 5 · ОСЕНЬ 2026</Text>
              <Title id="session-overview-title" level={2}>
                Что в сессии
              </Title>
              <Text type="secondary">
                Типы аттестации указаны в данных предметов. Даты экзаменов и
                зачетов по дисциплинам пока не распределены.
              </Text>
            </div>
            <div className="session-overview-grid">
              <article className="session-overview-item">
                <div className="session-overview-item-heading">
                  <Title level={3}>Экзамены</Title>
                  <Tag color="blue">{examSubjects.length}</Tag>
                </div>
                <ul className="session-subject-list">
                  {examSubjects.map((subject) => (
                    <li key={subject.id}>
                      <a href={`/subjects/${subject.id}`}>{subject.name}</a>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="session-overview-item">
                <div className="session-overview-item-heading">
                  <Title level={3}>Зачеты</Title>
                  <Tag color="green">{creditSubjects.length}</Tag>
                </div>
                <ul className="session-subject-list">
                  {creditSubjects.map((subject) => (
                    <li key={subject.id}>
                      <a href={`/subjects/${subject.id}`}>{subject.name}</a>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="session-overview-item">
                <div className="session-overview-item-heading">
                  <Title level={3}>Курсовая</Title>
                  <Tag color="gold">по предоставленной информации</Tag>
                </div>
                <Text className="session-overview-note">
                  Информация о свободных местах по большинству кафедр не указана.
                </Text>
                <details className="coursework-chairs">
                  <summary>
                    Кафедры и контакты ({courseworkDepartments.length})
                  </summary>
                  <div className="coursework-department-list">
                    {courseworkDepartments.map(({ department, subjects }) => (
                      <details className="coursework-department" key={department}>
                        <summary className="coursework-department-summary">
                          <span>{department}</span>
                          {department === 'Кафедра криминалистики' && (
                            <Tag className="availability-no-spaces" color="red">
                              Мест нет
                            </Tag>
                          )}
                        </summary>
                        <div className="coursework-department-content">
                          <div className="coursework-detail-row">
                            <Text className="coursework-detail-label">Заведующий</Text>
                            <Text>{departmentContacts.find((contact) => contact.department === department)?.head ?? 'Информация не указана'}</Text>
                          </div>
                          <div className="coursework-detail-row">
                            <Text className="coursework-detail-label">Предметы</Text>
                            <div className="coursework-subject-links">
                              {subjects.map((subject) => (
                                <a href={`/subjects/${subject.id}`} key={subject.id}>
                                  {subject.name}
                                </a>
                              ))}
                            </div>
                          </div>
                          <div className="coursework-detail-row">
                            <Text className="coursework-detail-label">Кабинет</Text>
                            <Text>{departmentContacts.find((contact) => contact.department === department)?.room ?? 'Не указан'}</Text>
                          </div>
                          <div className="coursework-detail-row">
                            <Text className="coursework-detail-label">Контакты</Text>
                            <div className="coursework-contact-links">
                              {departmentContacts.find((contact) => contact.department === department)?.phone && (
                                <a href={`tel:${departmentContacts.find((contact) => contact.department === department)?.phone}`}>
                                  {departmentContacts.find((contact) => contact.department === department)?.phone}
                                </a>
                              )}
                              {departmentContacts.find((contact) => contact.department === department)?.email ? (
                                <a href={`mailto:${departmentContacts.find((contact) => contact.department === department)?.email}`}>
                                  {departmentContacts.find((contact) => contact.department === department)?.email}
                                </a>
                              ) : (
                                <Text>e-mail не публикуется</Text>
                              )}
                              {departmentContacts.find((contact) => contact.department === department)?.headPhone && (
                                <Text>
                                  Телефон кабинета заведующей: {departmentContacts.find((contact) => contact.department === department)?.headPhone}
                                </Text>
                              )}
                            </div>
                          </div>
                          {department === 'Кафедра криминалистики' && (
                            <Text className="coursework-form-caution">
                              По информации из Telegram-группы, мест уже нет.
                            </Text>
                          )}
                          {department === 'Кафедра права интеллектуальной собственности' && (
                            <Text className="coursework-form-caution">
                              Кабинет 213 общий с кафедрой гражданского права.
                            </Text>
                          )}
                          {department !== 'Кафедра криминалистики' && (
                            <Text className="department-availability">
                              Информация о свободных местах не указана.
                            </Text>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
                <details className="faculty-contact-details">
                  <summary>Общие контакты юрфака</summary>
                  <div className="coursework-department-content">
                    <a href={`tel:${facultyContacts.deaneryPhone}`}>
                      Деканат: {facultyContacts.deaneryPhone}
                    </a>
                    <a href={`tel:${facultyContacts.receptionPhone}`}>
                      Приемная: {facultyContacts.receptionPhone}
                    </a>
                    <a href={`mailto:${facultyContacts.email}`}>
                      {facultyContacts.email}
                    </a>
                    <Text>{facultyContacts.address}</Text>
                  </div>
                </details>
                <div className="coursework-guide-link">
                  <Text className="session-overview-note">
                    Оформление курсовых работ
                  </Text>
                  <a
                    className="detail-link"
                    href="/materials/bsu-coursework-guidelines-2024.pdf"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Методические рекомендации юрфака БГУ, 2024 (PDF)
                  </a>
                </div>
              </article>

              <article className="session-overview-item">
                <div className="session-overview-item-heading">
                  <Title level={3}>Контрольная работа</Title>
                  <Tag>{controlWorkSubjects.length}</Tag>
                </div>
                {controlWorkSubjects.length > 0 ? (
                  <ul className="session-subject-list">
                    {controlWorkSubjects.map((subject) => (
                      <li key={subject.id}>
                        <a href={`/subjects/${subject.id}`}>{subject.name}</a>
                        <details className="control-work-details">
                          <summary>{subject.controlWork?.status}</summary>
                          {(subject.materials ?? [])
                            .filter((material) =>
                              /контрольной работе/i.test(material.title),
                            )
                            .map((material) => (
                              <a
                                className="material-link"
                                download
                                href={material.href}
                                key={material.href}
                              >
                                <FileTextOutlined />
                                <span>{material.title}</span>
                                <Text className="material-format">
                                  {material.format}
                                </Text>
                                <DownloadOutlined />
                              </a>
                            ))}
                          {subject.controlWork?.caution && (
                            <Text className="session-overview-caution">
                              {subject.controlWork.caution}
                            </Text>
                          )}
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text className="session-overview-note">
                    Предмет пока не указан
                  </Text>
                )}
              </article>

              <article className="session-overview-item practice-overview">
                <div className="session-overview-item-heading">
                  <Title level={3}>Практики</Title>
                </div>
                <div className="practice-periods">
                  <div className="practice-period">
                    <Text strong>Правоприменительная</Text>
                    <Text>1-13 февраля 2027</Text>
                  </div>
                  <div className="practice-period">
                    <Text strong>Профессионально-ориентированная</Text>
                    <Text>15-27 февраля 2027</Text>
                  </div>
                </div>
                <div className="practice-shared-info">
                  <div className="practice-requirement-block">
                    <Tag color="gold">Документы подать до 4 декабря 2026</Tag>
                    <ul className="practice-requirements">
                      <li>Отдельное заявление на каждый вид практики.</li>
                      <li>
                        Гарантийное письмо от организации; если обе практики
                        проходят в одной организации, достаточно одного письма.
                      </li>
                      <li>
                        При прохождении по месту работы нужна справка с места
                        работы о занимаемой должности.
                      </li>
                    </ul>
                    <Text className="session-overview-note">
                      Объявление рекомендует выбрать одну организацию для обеих практик.
                    </Text>
                  </div>
                  <div className="practice-materials">
                    <details className="practice-collapsible">
                      <summary>Образцы заявлений (3)</summary>
                      <div className="practice-collapsible-content">
                        <a
                          className="practice-material-link"
                          download
                          href="/materials/practice/application-law-enforcement-practice.doc"
                        >
                          <FileTextOutlined />
                          <span>Правоприменительная практика</span>
                          <Text className="material-format">DOC</Text>
                          <DownloadOutlined />
                        </a>
                        <a
                          className="practice-material-link"
                          download
                          href="/materials/practice/application-professional-oriented-practice.doc"
                        >
                          <FileTextOutlined />
                          <span>Профессионально-ориентированная практика</span>
                          <Text className="material-format">DOC</Text>
                          <DownloadOutlined />
                        </a>
                        <a
                          className="practice-material-link practice-combined-form"
                          download
                          href="/materials/practice/application-both-practices.doc"
                        >
                          <FileTextOutlined />
                          <span>Объединенное заявление на обе практики</span>
                          <Text className="material-format">DOC</Text>
                          <DownloadOutlined />
                        </a>
                        <Text className="practice-form-caution">
                          Объединенную форму использовать только после согласования
                          с деканатом; объявление требует отдельное заявление на каждый
                          вид практики.
                        </Text>
                      </div>
                    </details>
                    <details className="practice-collapsible">
                      <summary>Образцы гарантийных писем (2)</summary>
                      <div className="practice-collapsible-content">
                      <a
                        className="practice-material-link"
                        download
                        href="/materials/practice/guarantee-law-enforcement-practice.docx"
                      >
                        <FileTextOutlined />
                        <span>Для правоприменительной практики, 1-13 февраля</span>
                        <Text className="material-format">DOCX</Text>
                        <DownloadOutlined />
                      </a>
                      <a
                        className="practice-material-link"
                        download
                        href="/materials/practice/guarantee-both-practices.docx"
                      >
                        <FileTextOutlined />
                        <span>Для обеих практик, 1-27 февраля</span>
                        <Text className="material-format">DOCX</Text>
                        <DownloadOutlined />
                      </a>
                      <Text className="practice-form-caution">
                        Второй шаблон назван учебным, но в тексте охватывает
                        правоприменительную и профессионально-ориентированную практики.
                      </Text>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}

        {isSchedulePath && (
          <section className="expanded-schedule" aria-labelledby="expanded-schedule-title">
            <a className="back-link" href="/">
              <ArrowLeftOutlined /> Календарь сессии
            </a>
            <Text className="section-kicker">СЕССИЯ 5 · ОСЕНЬ 2026</Text>
            <Title id="expanded-schedule-title" level={2}>
              Полное расписание
            </Title>
            <Text className="session-range">
              Сессия 5 (осень 2026): с {formatScheduleDate(sessionRange.start)} по{' '}
              {formatScheduleDate(sessionRange.end)}
            </Text>
            <div className="calendar-layout expanded-calendar-layout">
              <CalendarGrid
                events={calendarEvents}
                onSelectDate={setSelectedDate}
                selectedDate={selectedDate}
              />
              <aside aria-live="polite" className="calendar-selection">
                <Text className="section-kicker">ВЫБРАННАЯ ДАТА</Text>
                {selectedDate ? (
                  <>
                    <Title level={3}>{formatScheduleDate(selectedDate)}</Title>
                    {selectedEvents.map((event) => (
                      <div className="calendar-event-detail" key={`${event.date}-${event.kind}-${event.detail}`}>
                        <Text className="schedule-date-kind">{event.kind}</Text>
                        <Text className="schedule-date-detail">{event.detail}</Text>
                      </div>
                    ))}
                  </>
                ) : (
                  <Text>Даты пока не указаны</Text>
                )}
              </aside>
            </div>
            {hasOfficialSchedule ? (
              <div className="official-schedule-list">
                {officialSchedule.map((event) => (
                  <article className="official-schedule-item" key={`${event.date}-${event.time}-${event.group}`}>
                    <div>
                      <Text className="schedule-date-value">
                        {formatScheduleDate(event.date)}
                      </Text>
                      <Text className="schedule-date-kind">{event.kind}</Text>
                    </div>
                    <div className="official-schedule-details">
                      <Text strong>{event.time}</Text>
                      <Text>{event.subject}</Text>
                      <Text>{event.group}</Text>
                      <Text>{event.location}</Text>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty description="Официальное расписание еще не опубликовано" />
            )}
          </section>
        )}

        {!isSchedulePath && <section className="subjects-section" aria-labelledby="subjects-title">
          <div className="section-heading">
            {selectedSubject ? (
              <div className="subject-page-heading">
                <a className="back-link" href="/">
                  <ArrowLeftOutlined /> Все предметы
                </a>
                <Text className="section-kicker">СТРАНИЦА ПРЕДМЕТА</Text>
                <Title id="subjects-title" level={2}>
                  {selectedSubject.name}
                </Title>
                <Text type="secondary">Информация о курсе и материалы</Text>
              </div>
            ) : isSubjectPath ? (
              <div className="subject-page-heading">
                <a className="back-link" href="/">
                  <ArrowLeftOutlined /> Все предметы
                </a>
                <Title id="subjects-title" level={2}>
                  Предмет не найден
                </Title>
              </div>
            ) : (
              <>
                <div>
                  <Text className="section-kicker">ОБЗОР</Text>
                  <Title id="subjects-title" level={2}>
                    Учебные предметы
                  </Title>
                  <Text type="secondary">{publicSubjects.length} дисциплин</Text>
                </div>
                <Input
                  allowClear
                  aria-label="Поиск по предметам, преподавателям и информации курса"
                  className="subject-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Найти предмет, преподавателя или тему"
                  prefix={<SearchOutlined />}
                  value={query}
                />
              </>
            )}
          </div>

          {isSubjectPath && !selectedSubject ? (
            <Empty description="Проверьте ссылку на предмет" />
          ) : (selectedSubject ? [selectedSubject] : filteredSubjects).length > 0 ? (
            <Row gutter={[20, 20]} align="stretch">
              {(selectedSubject ? [selectedSubject] : filteredSubjects).map((subject) => (
                <Col key={subject.id} xs={24} sm={selectedSubject ? 24 : 12} xl={selectedSubject ? 24 : 8}>
                  <Card
                    className={`subject-card${selectedSubject ? ' subject-detail-card' : ''}`}
                    variant="borderless"
                  >
                    <div className="subject-card-heading">
                      <div className="subject-icon">
                        <BookOutlined />
                      </div>
                      <Tag className="subject-tag">Предмет</Tag>
                    </div>

                    <Title className="subject-title" level={3}>
                      {subject.name}
                    </Title>

                    <div className="assessment-info">
                      <Tag color={subject.assessment.type === 'Экзамен' ? 'blue' : 'green'}>
                        {subject.assessment.type}
                      </Tag>
                      <Text>{subject.assessment.format}</Text>
                    </div>

                    <div className="subject-facts">
                      <div>
                        <Text className="fact-label">Кафедра</Text>
                        <Text className="fact-value">
                          {subject.department ?? 'Информация не указана'}
                        </Text>
                      </div>
                      <div>
                        <Text className="fact-label">Преподаватель</Text>
                        <Text className="fact-value">
                          {subject.instructor.name}
                        </Text>
                        <Text className="instructor-position">
                          {subject.instructor.position}
                        </Text>
                      </div>
                    </div>

                    <div className="subject-overview-sections">
                      <section className="detail-section course-info">
                        <div className="detail-heading">
                          <BookOutlined />
                          <Text strong>Информация курса</Text>
                        </div>
                        {subject.courseInfo.map((item) => (
                          <div className="course-note" key={item.text}>
                            <Paragraph className="course-note-text">
                              {item.text}
                            </Paragraph>
                            {item.caution && (
                              <Text className="course-note-caution">
                                {item.caution}
                              </Text>
                            )}
                          </div>
                        ))}
                        {subject.courseInfo.length === 0 && (
                          <Text className="empty-detail">
                            Дополнительных сведений преподавателя в доступных
                            материалах пока нет.
                          </Text>
                        )}
                      </section>

                      <section className="detail-section">
                        <div className="detail-heading">
                          <LinkOutlined />
                          <Text strong>Полезные ссылки</Text>
                        </div>
                        {subject.portalUrl && (
                          <div className="detail-link-item">
                            <a
                              className="detail-link"
                              href={subject.portalUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Учебный портал БГУ
                            </a>
                            {subject.portalNote && (
                              <Text className="detail-link-note">
                                {subject.portalNote}
                              </Text>
                            )}
                          </div>
                        )}
                        {subject.links.map((link) => (
                          <div className="detail-link-item" key={link.url}>
                            <a
                              className="detail-link"
                              href={link.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {link.title}
                            </a>
                            {link.note && (
                              <Text className="detail-link-note">
                                {link.note}
                              </Text>
                            )}
                          </div>
                        ))}
                        {!subject.portalUrl && subject.links.length === 0 && (
                          <Text className="empty-detail">
                            Полезные ссылки пока не добавлены
                          </Text>
                        )}
                      </section>
                    </div>

                    {selectedSubject && (
                      <section
                        aria-labelledby="subject-schedule-title"
                        className="subject-schedule-section"
                      >
                        <div className="subject-schedule-heading">
                          <div>
                            <Text className="section-kicker">РАСПИСАНИЕ ПРЕДМЕТА</Text>
                            <Title id="subject-schedule-title" level={3}>
                              Занятия и аттестация
                            </Title>
                          </div>
                          <CalendarOutlined />
                        </div>
                        {subjectSchedule.length > 0 ? (
                          <div className="subject-calendar-layout">
                            <CalendarGrid
                              events={subjectCalendarEvents}
                              onSelectDate={setSelectedSubjectDate}
                              selectedDate={selectedSubjectDate}
                            />
                            <div className="subject-schedule-list">
                              {selectedSubjectEvents.map((event) => (
                                <article
                                  className="subject-schedule-event"
                                  key={`${event.date}-${event.time}-${event.kind}`}
                                >
                                  <div className="subject-event-meta">
                                    <Text className="schedule-date-value">
                                      {formatScheduleDate(event.date)}
                                    </Text>
                                    <Tag color={event.kind === 'Экзамен' || event.kind === 'Зачет' ? 'gold' : 'green'}>
                                      {event.kind}
                                    </Tag>
                                  </div>
                                  <Text strong>{event.time}</Text>
                                  <Text>{event.location}</Text>
                                  <div className="subject-preparation">
                                    <Text strong>Подготовить</Text>
                                    <Text>{event.preparation}</Text>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Text className="empty-detail">
                            Расписание занятий по этому предмету появится после публикации официального расписания.
                          </Text>
                        )}
                      </section>
                    )}

                    {!selectedSubject && (
                      <div className="subject-page-teaser">
                        <Text className="subject-page-teaser-label">
                          Дополнительная информация на странице предмета
                        </Text>
                        <Text className="subject-page-teaser-content">
                          Материалы курса · требования · темы · аналитика · расписание
                        </Text>
                        <a className="subject-page-link" href={`/subjects/${subject.id}`}>
                          Открыть страницу предмета <ArrowRightOutlined />
                        </a>
                      </div>
                    )}

                    {selectedSubject && <div className="subject-sections">
                      {subject.materials && subject.materials.length > 0 && (
                        <details className="detail-accordion material-accordion">
                          <summary>
                            Материалы курса ({subject.materials.length})
                          </summary>
                          <div className="accordion-content">
                            {subject.materials.map((material) => (
                              <div className="material-entry" key={material.href}>
                                <Text className="material-category">
                                  {material.category}
                                </Text>
                                <a
                                  className="material-link"
                                  download
                                  href={material.href}
                                >
                                  <FileTextOutlined />
                                  <span>{material.title}</span>
                                  <Text className="material-format">
                                    {material.format}
                                  </Text>
                                  <DownloadOutlined />
                                </a>
                                {material.caution && (
                                  <Text className="material-caution">
                                    {material.caution}
                                  </Text>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      <section className="detail-section">
                        <div className="detail-heading">
                          <BookOutlined />
                          <Text strong>Что требуется</Text>
                        </div>
                        {subject.requirements.map((item) => (
                          <div className="requirement-note" key={item.text}>
                            <div className="requirement-heading">
                              <Tag
                                color={
                                  item.status === 'Известно' ? 'green' : 'gold'
                                }
                              >
                                {item.status}
                              </Tag>
                            </div>
                            <Paragraph className="course-note-text">
                              {item.text}
                            </Paragraph>
                          </div>
                        ))}
                      </section>

                      {(subject.topicGroups.length > 0 ||
                        subject.topicItems.length > 0) && (
                        <details className="detail-accordion">
                          <summary>
                            {subject.topicListTitle ??
                              (subject.topicItems.length > 0
                                ? `Вопросы и темы (${subject.topicItems.length})`
                                : `Тематические блоки (${subject.topicGroups.length})`)}
                          </summary>
                          <div className="accordion-content">
                            {subject.topicGroups.map((group) => (
                              <div className="topic-group" key={group.title}>
                                <Text strong>{group.title}</Text>
                                <Text>{group.detail}</Text>
                              </div>
                            ))}
                            {subject.topicItems.length > 0 && (
                              <ol className="topic-list">
                                {subject.topicItems.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </details>
                      )}

                      {subject.analysis.length > 0 && (
                        <details className="detail-accordion">
                          <summary>Аналитика, предположения и пробелы</summary>
                          <div className="accordion-content">
                            {subject.analysis.map((item) => (
                              <Paragraph className="analysis-note" key={item}>
                                {item}
                              </Paragraph>
                            ))}
                          </div>
                        </details>
                      )}

                      <section className="detail-section comments-section">
                        <div className="detail-heading">
                          <MessageOutlined />
                          <Text strong>Комментарии</Text>
                        </div>
                        {subject.comments.length > 0 ? (
                          subject.comments.map((comment) => (
                            <Paragraph className="comment" key={comment}>
                              {comment}
                            </Paragraph>
                          ))
                        ) : (
                          <Text className="empty-detail">
                            Публичных комментариев пока нет
                          </Text>
                        )}
                      </section>
                    </div>}
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty
              className="empty-search"
              description="По вашему запросу ничего не найдено"
            />
          )}
        </section>}

        {!isSubjectPath && !isSchedulePath && <footer className="dashboard-footer">
          <Space size={8}>
            <span className="footer-mark" />
            <Text type="secondary">
              Сведения о преподавателях взяты из расписания 2025-2026;
              продолжение преподавания подтверждено. Предварительные даты
              требуют сверки с официальным расписанием.
            </Text>
          </Space>
        </footer>}
      </main>
    </ConfigProvider>
  )
}

export default App
