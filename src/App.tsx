import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  LinkOutlined,
  MessageOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Card,
  Col,
  Checkbox,
  ConfigProvider,
  Empty,
  Input,
  Row,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import {
  departmentContacts,
  facultyContacts,
  preliminarySchedule,
  publicSubjects,
  sessionRange,
  type PublicSubject,
} from './data/publicSubjects'
import {
  officialSchedule,
  officialScheduleSource,
} from './data/officialSchedule'
import './App.css'

const { Paragraph, Text, Title } = Typography
const weekdayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']
const scheduleDayStart = 8 * 60
const scheduleDayEnd = 22 * 60
const scheduleSlotMinutes = 30
const minimumEventDisplayMinutes = 60
const changedEventDisplayMinutes = 90
type StudyGroup = 'ОБЩ' | 'СПС' | 'ХОЗ'

interface CalendarEvent {
  date: string
  kind: string
  detail: string
  group?: string
  changeNotice?: string
}

const scheduleEventKindStyles: Record<string, { className: string; tagColor: string }> = {
  Лекция: { className: 'lecture', tagColor: 'blue' },
  Семинар: { className: 'seminar', tagColor: 'cyan' },
  'Практическое занятие': { className: 'practice', tagColor: 'purple' },
  Консультация: { className: 'consultation', tagColor: 'geekblue' },
  Зачет: { className: 'credit', tagColor: 'gold' },
  Экзамен: { className: 'exam', tagColor: 'red' },
}

function getScheduleEventKindStyle(kind: string) {
  return scheduleEventKindStyles[kind] ?? { className: 'other', tagColor: 'default' }
}

interface TodayAgendaItem {
  key: string
  time: string
  kind: string
  subject: string
  group: string
  location: string
  instructor: string
  detail: string
  status: string | null
  changeNotice?: string
}

function getScheduleChangeNotice(
  scheduleChange: { previousTime: string } | undefined,
  time: string,
) {
  return scheduleChange
    ? `Перенос времени: было ${scheduleChange.previousTime}, теперь ${time}`
    : undefined
}

function getScheduleSubjectSlug(subject: string) {
  return subject
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function isScheduleEventVisible(group: string | undefined, selectedGroup: StudyGroup) {
  if (selectedGroup === 'ОБЩ') return true

  const normalizedGroup = (group ?? '').trim().toLocaleUpperCase('ru')
  if (!normalizedGroup || normalizedGroup.includes('ОБЩ')) return true

  const groupAliases = selectedGroup === 'СПС'
    ? ['СПС', 'СУДЕБНО-ПРОКУРОРСКО-СЛЕДСТВЕННАЯ ДЕЯТЕЛЬНОСТЬ']
    : ['ХОЗ', 'ХОЗЯЙСТВЕННОЕ ПРАВО']

  return groupAliases.some((alias) => normalizedGroup.includes(alias))
}

function getTimeValues(time: string) {
  return Array.from(time.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g), (match) =>
    Number(match[1]) * 60 + Number(match[2]),
  )
}

function getTodayEventStatus(time: string, currentMinutes: number) {
  const [start, end] = getTimeValues(time)
  if (start === undefined) return null
  if (end !== undefined) {
    if (currentMinutes < start) return 'Далее'
    if (currentMinutes < end) return 'Сейчас идет'
    return 'Завершено'
  }
  return currentMinutes < start ? 'Далее' : null
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

function formatScheduleDate(date: string) {
  return parseScheduleDate(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function addDays(date: string, count: number) {
  const result = parseScheduleDate(date)
  result.setDate(result.getDate() + count)
  return toLocalISODate(result)
}

function getWeekStart(date: string) {
  const parsedDate = parseScheduleDate(date)
  parsedDate.setDate(parsedDate.getDate() - ((parsedDate.getDay() + 6) % 7))
  return toLocalISODate(parsedDate)
}

function formatWeekdayDate(date: string) {
  return parseScheduleDate(date).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatFullWeekdayDate(date: string) {
  return parseScheduleDate(date).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface PositionedWeekEvent {
  event: (typeof officialSchedule)[number]
  startMinutes: number
  endMinutes: number
  displayEndMinutes: number
  lane: number
  laneCount: number
}

function layoutWeekEvents(events: readonly (typeof officialSchedule)[number][]) {
  const timedEvents = events.flatMap((event) => {
    const [startMinutes, endMinutes] = getTimeValues(event.time)
    if (startMinutes === undefined) return []

    return [{
      event,
      startMinutes,
      endMinutes: endMinutes ?? startMinutes + scheduleSlotMinutes,
      displayEndMinutes: Math.max(
        endMinutes ?? startMinutes + scheduleSlotMinutes,
        startMinutes + (
          event.scheduleChange
            ? changedEventDisplayMinutes
            : minimumEventDisplayMinutes
        ),
      ),
      lane: 0,
      laneCount: 1,
    }]
  }).sort((first, second) =>
    first.startMinutes - second.startMinutes ||
    first.displayEndMinutes - second.displayEndMinutes,
  )

  const positioned: PositionedWeekEvent[] = []
  let cluster: typeof timedEvents = []
  let clusterEnd = -1

  const placeCluster = () => {
    if (cluster.length === 0) return

    const laneEnds: number[] = []
    const clusterEvents = cluster.map((item) => {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMinutes)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = item.displayEndMinutes
      return { ...item, lane }
    })
    const laneCount = laneEnds.length
    positioned.push(...clusterEvents.map((item) => ({ ...item, laneCount })))
    cluster = []
    clusterEnd = -1
  }

  for (const event of timedEvents) {
    if (cluster.length > 0 && event.startMinutes >= clusterEnd) placeCluster()
    cluster.push(event)
    clusterEnd = Math.max(clusterEnd, event.endMinutes)
  }
  placeCluster()

  return positioned
}

function WeekCalendar({
  weekStart,
  events,
}: {
  weekStart: string
  events: readonly (typeof officialSchedule)[number][]
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const hourLabels = Array.from(
    { length: (scheduleDayEnd - scheduleDayStart) / 60 },
    (_, index) => scheduleDayStart / 60 + index,
  )

  return (
    <div aria-label="Расписание на неделю" className="weekly-calendar-scroll">
      <div className="weekly-calendar">
        <div className="weekly-calendar-header">
          <span aria-hidden="true" className="weekly-time-gutter" />
          {days.map((date) => {
            const dayEvents = events.filter((event) => event.date === date)
            return (
              <div className="weekly-day-heading" key={date}>
                <Text>{formatWeekdayDate(date)}</Text>
                <Text className="weekly-day-count">
                  {dayEvents.length ? `${dayEvents.length} событий` : 'Нет занятий'}
                </Text>
              </div>
            )
          })}
        </div>
        <div className="weekly-calendar-body">
          <div aria-hidden="true" className="weekly-time-column">
            {hourLabels.map((hour, index) => (
              <span
                className="weekly-time-label"
                key={hour}
                style={{ gridRow: `${index * 2 + 1}` }}
              >
                {`${String(hour).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {days.map((date) => {
            const dayEvents = layoutWeekEvents(
              events.filter((event) => event.date === date),
            )

            return (
              <section
                aria-label={`${formatWeekdayDate(date)}, ${dayEvents.length} событий`}
                className="weekly-day-column"
                key={date}
              >
                <div
                  className="weekly-day-track"
                  style={{
                    '--weekly-event-lanes': Math.max(1, ...dayEvents.map((event) => event.laneCount)),
                  } as CSSProperties & { '--weekly-event-lanes': number }}
                >
                  {dayEvents.map(({ event, startMinutes, displayEndMinutes, lane, laneCount }) => {
                    const visibleStart = Math.max(startMinutes, scheduleDayStart)
                    const visibleEnd = Math.min(displayEndMinutes, scheduleDayEnd)
                    if (visibleEnd <= visibleStart) return null

                    const startSlot = Math.floor(
                      (visibleStart - scheduleDayStart) / scheduleSlotMinutes,
                    )
                    const endSlot = Math.max(
                      startSlot + 1,
                      Math.ceil((visibleEnd - scheduleDayStart) / scheduleSlotMinutes),
                    )
                    const eventStyle = getScheduleEventKindStyle(event.kind)

                    return (
                      <article
                        className={`weekly-event weekly-event--${eventStyle.className}${event.scheduleChange ? ' weekly-event--changed' : ''}`}
                        key={`${event.date}-${event.time}-${event.subject}-${event.group}`}
                        style={{
                          gridColumn: `${lane + 1} / span 1`,
                          gridRow: `${startSlot + 1} / span ${endSlot - startSlot}`,
                          '--weekly-event-lanes': laneCount,
                        } as CSSProperties & { '--weekly-event-lanes': number }}
                        title={`${event.time} · ${event.kind} · ${event.subject} · ${event.group}${event.scheduleChange ? ` · Перенос времени: было ${event.scheduleChange.previousTime}, теперь ${event.time}` : ''}`}
                      >
                        <Text className="weekly-event-time">{event.time}</Text>
                        <Text className="weekly-event-subject">{event.subject}</Text>
                        <Text className="weekly-event-kind">{event.kind}</Text>
                        <Text className="weekly-event-group">{event.group}</Text>
                        {event.scheduleChange && (
                          <Text className="weekly-event-change">
                            Перенос с {event.scheduleChange.previousTime} на {event.time}
                          </Text>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

async function downloadWeekPdf(
  weekStart: string,
  weekEnd: string,
  events: readonly (typeof officialSchedule)[number][],
  selectedGroup: StudyGroup,
  selectedKinds: readonly string[],
) {
  const [{ default: pdfMake }, { default: virtualFileSystem }] =
    await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ])
  pdfMake.addVirtualFileSystem(virtualFileSystem)

  const eventsByDate = [...events]
    .sort((first, second) =>
      first.date.localeCompare(second.date) ||
      (getTimeValues(first.time)[0] ?? 0) - (getTimeValues(second.time)[0] ?? 0),
    )
    .reduce<(typeof events[number])[][]>((days, event) => {
      const currentDay = days.at(-1)
      if (currentDay?.[0]?.date === event.date) {
        currentDay.push(event)
      } else {
        days.push([event])
      }
      return days
    }, [])
  const document: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [24, 28, 24, 34],
    defaultStyle: { font: 'Roboto', fontSize: 7, color: '#1A202C' },
    styles: {
      title: { fontSize: 16, bold: true, color: '#0A3470', margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 8, color: '#4A5568', margin: [0, 0, 0, 10] },
      dayHeading: { fontSize: 10, bold: true, color: '#0A3470' },
      tableHeader: { bold: true, color: '#FFFFFF', fillColor: '#0A3470' },
    },
    content: [
      { text: 'Расписание сессии', style: 'title' },
      {
        text: `Неделя: ${formatScheduleDate(weekStart)} - ${formatScheduleDate(weekEnd)} · Группа: ${selectedGroup} · Типы: ${selectedKinds.join(', ') || 'не выбраны'}`,
        style: 'subtitle',
      },
      ...(eventsByDate.length
        ? eventsByDate.flatMap((dayEvents) => [
            {
              table: {
                widths: ['*'],
                body: [[{
                  text: formatFullWeekdayDate(dayEvents[0].date),
                  style: 'dayHeading',
                }]],
              },
              layout: {
                fillColor: () => '#E8EFF8',
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 6,
                paddingRight: () => 6,
                paddingTop: () => 5,
                paddingBottom: () => 5,
              },
              margin: [0, 8, 0, 4] as [number, number, number, number],
            },
            {
              table: {
                headerRows: 1,
                widths: [62, 50, '*', 59, 76, 43],
                body: [
                  [
                    { text: 'Время', style: 'tableHeader' },
                    { text: 'Тип', style: 'tableHeader' },
                    { text: 'Предмет', style: 'tableHeader' },
                    { text: 'Группа', style: 'tableHeader' },
                    { text: 'Преподаватель', style: 'tableHeader' },
                    { text: 'Аудитория', style: 'tableHeader' },
                  ],
                  ...dayEvents.map((event) => [
                    event.scheduleChange
                      ? `${event.time} (перенос, было ${event.scheduleChange.previousTime})`
                      : event.time,
                    event.kind,
                    event.subject,
                    event.group,
                    event.instructor,
                    event.location ?? '',
                  ]),
                ],
              },
              layout: {
                fillColor: (rowIndex: number) =>
                  rowIndex > 0 && rowIndex % 2 === 0 ? '#F5F7FA' : null,
                hLineColor: () => '#E3E8EF',
                vLineColor: () => '#E3E8EF',
                paddingLeft: () => 4,
                paddingRight: () => 4,
                paddingTop: () => 4,
                paddingBottom: () => 4,
              },
              margin: [0, 0, 0, 5] as [number, number, number, number],
            },
          ])
        : [{ text: 'На выбранную неделю нет событий по текущим фильтрам.' }]),
    ],
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'right',
      margin: [0, 0, 26, 0],
      fontSize: 8,
      color: '#4A5568',
    }),
  }

  const pdfBlob = await pdfMake.createPdf(document).getBlob()
  const downloadUrl = URL.createObjectURL(pdfBlob)
  const downloadLink = window.document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = `raspisanie-${weekStart}-${weekEnd}.pdf`
  downloadLink.click()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
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
  showEventKinds = false,
}: {
  events: readonly CalendarEvent[]
  selectedDate: string
  onSelectDate: (date: string) => void
  showEventKinds?: boolean
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
      {showEventKinds && events.some((event) => event.changeNotice) && (
        <Text className="calendar-change-legend">
          <span aria-hidden="true" className="calendar-change-marker">!</span>
          Перенос времени
        </Text>
      )}
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
              const eventKinds = [...new Set(dayEvents.map((event) => event.kind))]
              const hasScheduleChange = dayEvents.some((event) => event.changeNotice)
              const ariaLabel = [
                `${formatScheduleDate(date)}: ${dayEvents.map((event) => event.kind).join(', ')}`,
                ...dayEvents.flatMap((event) => event.changeNotice ? [event.changeNotice] : []),
              ].join('. ')

              return dayEvents.length > 0 ? (
                <button
                  aria-label={ariaLabel}
                  aria-pressed={selectedDate === date}
                  className={`calendar-day calendar-event-day${selectedDate === date ? ' is-selected' : ''}`}
                  key={date}
                  onClick={() => onSelectDate(date)}
                  title={dayEvents
                    .map((event) => [event.detail, event.changeNotice].filter(Boolean).join(' · '))
                    .join('; ')}
                  type="button"
                >
                  <span>{day}</span>
                  {showEventKinds ? (
                    <span aria-hidden="true" className="calendar-event-markers">
                      {eventKinds.map((kind) => (
                        <span
                          className={`calendar-event-marker calendar-event-marker--${getScheduleEventKindStyle(kind).className}`}
                          key={kind}
                        />
                      ))}
                      {hasScheduleChange && (
                        <span className="calendar-change-marker">!</span>
                      )}
                    </span>
                  ) : (
                    <span className="calendar-event-marker" />
                  )}
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

function ScheduleGroupSelector({
  selectedGroup,
  onChange,
}: {
  selectedGroup: StudyGroup
  onChange: (group: StudyGroup) => void
}) {
  const groups = [
    {
      value: 'ОБЩ' as const,
      title: 'Общий просмотр',
      detail: 'Совместное расписание и информация',
    },
    {
      value: 'СПС' as const,
      title: 'Судебно-прокурорско-следственная деятельность',
      detail: 'Расписание СПС и общие события',
    },
    {
      value: 'ХОЗ' as const,
      title: 'Хозяйственное право',
      detail: 'Расписание ХОЗ и общие события',
    },
  ]
  const selectedGroupTitle = groups.find((group) => group.value === selectedGroup)?.title

  return (
    <div className="schedule-group-control">
      <div className="schedule-group-heading">
        <div>
          <Text className="section-kicker">ПОКАЗАТЬ РАСПИСАНИЕ ДЛЯ</Text>
          <Text className="schedule-group-instruction">Выберите свою группу или общий просмотр</Text>
        </div>
        <Text className="schedule-group-current">
          <CheckCircleFilled /> Сейчас выбрано: {selectedGroupTitle}
        </Text>
      </div>
      <div aria-label="Учебная группа" className="schedule-group-options" role="radiogroup">
        {groups.map((group) => {
          const isSelected = group.value === selectedGroup

          return (
            <label
              className={`schedule-group-option${isSelected ? ' is-selected' : ''}`}
              key={group.value}
            >
              <input
                checked={isSelected}
                name="session-group"
                onChange={() => onChange(group.value)}
                type="radio"
                value={group.value}
              />
              <span className="schedule-group-code">{group.value}</span>
              <span className="schedule-group-option-copy">
                <span className="schedule-group-option-title">{group.title}</span>
                <span className="schedule-group-option-detail">{group.detail}</span>
              </span>
              <span aria-hidden="true" className="schedule-group-choice-state">
                {isSelected ? <><CheckCircleFilled /> Выбрано</> : 'Выбрать'}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleKindSelector({
  kinds,
  selectedKinds,
  onChange,
}: {
  kinds: readonly string[]
  selectedKinds: readonly string[]
  onChange: (kinds: string[]) => void
}) {
  return (
    <div aria-label="Фильтр по типам занятий" className="schedule-kind-control" role="group">
      <div className="schedule-kind-heading">
        <div>
          <Text className="section-kicker">ПОКАЗАТЬ ТИПЫ СОБЫТИЙ</Text>
          <Text className="schedule-group-instruction">
            Можно выбрать несколько типов одновременно
          </Text>
        </div>
        <button
          className="schedule-kind-reset"
          onClick={() => onChange([...kinds])}
          type="button"
        >
          Показать все
        </button>
      </div>
      <Checkbox.Group
        aria-label="Типы занятий и аттестации"
        className="schedule-kind-options"
        onChange={(values) => onChange(values.map(String))}
        value={[...selectedKinds]}
      >
        {kinds.map((kind) => {
          const kindStyle = getScheduleEventKindStyle(kind)
          const isSelected = selectedKinds.includes(kind)

          return (
            <div
              className={`schedule-kind-option schedule-kind-option--${kindStyle.className}${isSelected ? ' is-selected' : ''}`}
              key={kind}
            >
              <Checkbox value={kind}>{kind}</Checkbox>
              <span
                aria-hidden="true"
                className={`calendar-event-marker calendar-event-marker--${kindStyle.className}`}
              />
            </div>
          )
        })}
      </Checkbox.Group>
    </div>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const [isEnrollmentCodeVisible, setIsEnrollmentCodeVisible] = useState(false)
  const [enrollmentCodeCopyStatus, setEnrollmentCodeCopyStatus] = useState('')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => window.clearInterval(timerId)
  }, [])
  const today = toLocalISODate(currentTime)
  const todayLabel = currentTime.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const currentTimeLabel = currentTime.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup>(() => {
    const savedGroup = window.localStorage.getItem('bsu-session-dashboard-group-v1')
    return savedGroup === 'СПС' || savedGroup === 'ХОЗ' ? savedGroup : 'ОБЩ'
  })
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'
  const isSubjectPath = currentPath.startsWith('/subjects/')
  const isSchedulePath = currentPath === '/schedule'
  const publicSubject = publicSubjects.find(
    (subject) => currentPath === `/subjects/${subject.id}`,
  )
  const publicSubjectNames = new Set(publicSubjects.map((subject) => subject.name))
  const scheduleOnlySubjectNames = [...new Set(
    officialSchedule
      .map((event) => event.subject)
      .filter((name) => !publicSubjectNames.has(name)),
  )]
  const scheduleSubjectPaths = new Map(
    scheduleOnlySubjectNames.map((name) => [
      name,
      `/subjects/schedule-${encodeURIComponent(getScheduleSubjectSlug(name))}`,
    ]),
  )
  const selectedScheduleSubjectName = scheduleOnlySubjectNames.find(
    (name) => scheduleSubjectPaths.get(name) === currentPath,
  )
  const selectedScheduleSubject = selectedScheduleSubjectName
    ? officialSchedule.filter((event) => event.subject === selectedScheduleSubjectName)
    : []
  const selectedSubject: PublicSubject | undefined = publicSubject ??
    (selectedScheduleSubjectName
      ? {
          id: `schedule-${getScheduleSubjectSlug(selectedScheduleSubjectName)}`,
          name: selectedScheduleSubjectName,
          department: null,
          instructor: {
            name: [...new Set(selectedScheduleSubject.map((event) => event.instructor))]
              .filter(Boolean)
              .join(', ') || 'Информация не указана',
            position: '',
          },
          assessment: {
            type: selectedScheduleSubject.some((event) => event.kind === 'Экзамен')
              ? 'Экзамен'
              : selectedScheduleSubject.some((event) => event.kind === 'Зачет')
                ? 'Зачет'
                : 'Не указана',
            format: 'Смотрите опубликованное расписание',
            source: 'Официальное расписание сессии',
          },
          courseInfo: [],
          requirements: [],
          topicGroups: [],
          topicItems: [],
          analysis: [],
          portalUrl: null,
          links: [],
          comments: [],
        }
      : undefined)
  const isScheduleOnlySubject = Boolean(selectedScheduleSubjectName)
  const hasOfficialSchedule = officialSchedule.length > 0
  const calendarEvents: readonly CalendarEvent[] = hasOfficialSchedule
    ? officialSchedule.map((event) => ({
        date: event.date,
        kind: event.kind,
        detail: [event.time, event.subject, event.instructor, event.group, event.location]
          .filter(Boolean)
          .join(' · '),
        group: event.group,
        changeNotice: getScheduleChangeNotice(event.scheduleChange, event.time),
      }))
    : preliminarySchedule
  const calendarEventKinds = [...new Set(calendarEvents.map((event) => event.kind))]
  const [selectedEventKinds, setSelectedEventKinds] = useState<string[] | null>(null)
  const activeEventKinds = selectedEventKinds ?? calendarEventKinds
  const visibleCalendarEvents = calendarEvents.filter((event) =>
    isScheduleEventVisible(event.group, selectedGroup) &&
    activeEventKinds.includes(event.kind),
  )
  const sortedCalendarEvents = [...visibleCalendarEvents].sort((first, second) =>
    first.date.localeCompare(second.date),
  )
  const upcomingEvents = sortedCalendarEvents
    .filter((event) => event.date >= today)
    .slice(0, 5)
  const [selectedDate, setSelectedDate] = useState(
    upcomingEvents[0]?.date ?? sortedCalendarEvents[0]?.date ?? '',
  )
  const [weekStart, setWeekStart] = useState(() =>
    getWeekStart(upcomingEvents[0]?.date ?? today),
  )
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const handleGroupChange = (group: StudyGroup) => {
    setSelectedGroup(group)
    window.localStorage.setItem('bsu-session-dashboard-group-v1', group)
    const groupEvents = calendarEvents
      .filter((event) =>
        isScheduleEventVisible(event.group, group) &&
        activeEventKinds.includes(event.kind),
      )
      .sort((first, second) => first.date.localeCompare(second.date))
    const nextEvent = groupEvents.find((event) => event.date >= today) ?? groupEvents[0]
    setSelectedDate(nextEvent?.date ?? '')
  }
  const handleEventKindsChange = (kinds: string[]) => {
    setSelectedEventKinds(kinds.length === calendarEventKinds.length ? null : kinds)
    const activeKinds = kinds
    const filteredEvents = calendarEvents
      .filter((event) =>
        isScheduleEventVisible(event.group, selectedGroup) &&
        activeKinds.includes(event.kind),
      )
      .sort((first, second) => first.date.localeCompare(second.date))
    const nextEvent = filteredEvents.find((event) => event.date >= today) ?? filteredEvents[0]
    setSelectedDate(nextEvent?.date ?? '')
  }
  const selectedEvents = visibleCalendarEvents.filter(
    (event) => event.date === selectedDate,
  )
  const subjectSchedule = selectedSubject
    ? officialSchedule.filter(
        (event) =>
        (event.subjectId === selectedSubject.id ||
          (!event.subjectId && event.subject === selectedSubject.name)) &&
      isScheduleEventVisible(event.group, selectedGroup) &&
      activeEventKinds.includes(event.kind),
    )
    : []
  const visibleOfficialSchedule = officialSchedule.filter((event) =>
    isScheduleEventVisible(event.group, selectedGroup) &&
    activeEventKinds.includes(event.kind),
  )
  const weekEnd = addDays(weekStart, 6)
  const weekScheduleEvents = visibleOfficialSchedule.filter(
    (event) => event.date >= weekStart && event.date <= weekEnd,
  )
  const changeWeek = (offset: number) => {
    setWeekStart((currentWeekStart) => addDays(currentWeekStart, offset * 7))
  }
  const handleDownloadWeekPdf = async () => {
    setIsPdfLoading(true)
    setPdfError(null)
    try {
      await downloadWeekPdf(
        weekStart,
        weekEnd,
        weekScheduleEvents,
        selectedGroup,
        activeEventKinds,
      )
    } catch (error) {
      setPdfError(
        `Не удалось сформировать PDF: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsPdfLoading(false)
    }
  }
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const todayOfficialEvents = visibleOfficialSchedule
    .filter((event) => event.date === today)
    .sort((first, second) => {
      const firstTime = getTimeValues(first.time)[0] ?? Number.MAX_SAFE_INTEGER
      const secondTime = getTimeValues(second.time)[0] ?? Number.MAX_SAFE_INTEGER
      return firstTime - secondTime
    })
  const todayPreliminaryEvents = hasOfficialSchedule
    ? []
    : visibleCalendarEvents.filter((event) => event.date === today)
  const todayAgendaItems: TodayAgendaItem[] = hasOfficialSchedule
    ? todayOfficialEvents.map((event) => ({
        key: `${event.date}-${event.time}-${event.subject}-${event.group}`,
        time: event.time,
        kind: event.kind,
        subject: event.subject,
        group: event.group,
        location: event.location ?? '',
        instructor: event.instructor,
        detail: '',
        status: getTodayEventStatus(event.time, currentMinutes),
        changeNotice: getScheduleChangeNotice(event.scheduleChange, event.time),
      }))
    : todayPreliminaryEvents.map((event) => ({
        key: `${event.date}-${event.kind}-${event.detail}`,
        time: '',
        kind: event.kind,
        subject: event.kind,
        group: '',
        location: '',
        instructor: '',
        detail: event.detail,
        status: null,
      }))
  const currentAgendaItem = todayAgendaItems.find(
    (event) => event.status === 'Сейчас идет',
  )
  const nextAgendaItem = todayAgendaItems.find((event) => event.status === 'Далее')
  const hasUndeterminedCurrentEvent = todayAgendaItems.some((event) => {
    if (event.status !== null) return false
    const [start] = getTimeValues(event.time)
    return start === undefined || start <= currentMinutes
  })
  const allTodayEventsCompleted =
    todayAgendaItems.length > 0 &&
    todayAgendaItems.every((event) => event.status === 'Завершено')
  const currentMomentSummary = !hasOfficialSchedule
    ? 'Время занятий пока не опубликовано, поэтому проверить, идет ли занятие сейчас, нельзя.'
    : currentAgendaItem
      ? `Сейчас идет: ${currentAgendaItem.subject}.`
      : nextAgendaItem && hasUndeterminedCurrentEvent
        ? `Следующее занятие: ${nextAgendaItem.subject} в ${nextAgendaItem.time}. Текущий статус другого занятия по расписанию не определить.`
        : nextAgendaItem
          ? `Сейчас занятий нет. Следующее: ${nextAgendaItem.subject} в ${nextAgendaItem.time}.`
          : allTodayEventsCompleted
            ? 'Все запланированные на сегодня занятия завершились.'
            : todayAgendaItems.length === 0
              ? 'Сейчас по опубликованному расписанию учебных мероприятий нет.'
              : 'В расписании недостаточно данных о времени, чтобы определить, идет ли занятие сейчас.'
  const nextKnownEvent = [...visibleCalendarEvents]
    .filter((event) => event.date > today)
    .sort((first, second) => first.date.localeCompare(second.date))[0]
  const subjectCalendarEvents: CalendarEvent[] = subjectSchedule.map((event) => ({
    date: event.date,
    kind: event.kind,
    detail: `${event.time} · ${event.subject}`,
    changeNotice: getScheduleChangeNotice(event.scheduleChange, event.time),
  }))
  const subjectScheduleKinds = [...new Set(subjectSchedule.map((event) => event.kind))]
  const [selectedSubjectDate, setSelectedSubjectDate] = useState(
    subjectSchedule[0]?.date ?? '',
  )
  const effectiveSubjectDate = subjectSchedule.some(
    (event) => event.date === selectedSubjectDate,
  )
    ? selectedSubjectDate
    : subjectSchedule[0]?.date ?? ''
  const selectedSubjectEvents = subjectSchedule.filter(
    (event) => event.date === effectiveSubjectDate,
  )
  const subjectByName = new Map(publicSubjects.map((subject) => [subject.name, subject]))
  const subjectsFor = (events: typeof officialSchedule[number][]) =>
    Array.from(
      events.reduce((subjects, event) => {
        const subjectEvents = subjects.get(event.subject) ?? []
        subjectEvents.push(event)
        subjects.set(event.subject, subjectEvents)
        return subjects
      }, new Map<string, typeof officialSchedule[number][]>())
        .entries(),
      ([name, events]) => ({ name, events }),
    )
  const assessmentEvents = officialSchedule.filter(
    (event) => event.kind === 'Экзамен' || event.kind === 'Зачет',
  )
  const assessmentTracksBySubject = new Map<string, Set<string>>()
  assessmentEvents.forEach((event) => {
    if (event.group.startsWith('СПС')) {
      assessmentTracksBySubject.set(
        event.subject,
        (assessmentTracksBySubject.get(event.subject) ?? new Set()).add('СПС'),
      )
    } else if (event.group.startsWith('ХОЗ')) {
      assessmentTracksBySubject.set(
        event.subject,
        (assessmentTracksBySubject.get(event.subject) ?? new Set()).add('ХОЗ'),
      )
    } else {
      assessmentTracksBySubject.set(
        event.subject,
        (assessmentTracksBySubject.get(event.subject) ?? new Set()).add('ОБЩ'),
      )
    }
  })
  const examSubjects = subjectsFor(assessmentEvents.filter((event) => event.kind === 'Экзамен'))
  const creditSubjects = subjectsFor(assessmentEvents.filter((event) => event.kind === 'Зачет'))
  const noAssessmentSubjects = subjectsFor(
    officialSchedule.filter((event) => {
      if (event.kind === 'Экзамен' || event.kind === 'Зачет') return false

      const assessedTracks = assessmentTracksBySubject.get(event.subject)
      if (event.group.startsWith('СПС')) return !assessedTracks?.has('СПС')
      if (event.group.startsWith('ХОЗ')) return !assessedTracks?.has('ХОЗ')
      return !assessedTracks || assessedTracks.size === 0
    }),
  )
  const renderSessionSubjects = (
    subjects: { name: string; events: typeof officialSchedule[number][] }[],
    category: 'assessment' | 'noAssessment',
  ) => (
    subjects.length > 0 ? (
      <ul className="session-subject-list">
        {subjects.map(({ name, events }) => {
          const subject = subjectByName.get(name)
          const eventKinds = [...new Set(events.map((event) => event.kind))]
          const specializedTracks = [...new Set(events.flatMap((event) =>
            event.group.startsWith('СПС')
              ? ['СПСД']
              : event.group.startsWith('ХОЗ')
                ? ['ХОЗ']
                : [],
          ))]

          return (
            <li key={name}>
              <div className="session-subject-row">
                <span className="session-subject-title">
                  {subject ? (
                    <a href={`/subjects/${subject.id}`}>{name}</a>
                  ) : scheduleSubjectPaths.has(name) ? (
                    <a href={scheduleSubjectPaths.get(name)}>{name}</a>
                  ) : (
                    <Text strong>{name}</Text>
                  )}
                  {category === 'noAssessment' &&
                    specializedTracks.map((track) => <Tag key={track}>{track}</Tag>)}
                </span>
                {category === 'assessment' ? (
                  <span className="session-assessment-schedule">
                    {events.map((event) => (
                      <span
                        className="session-assessment-occurrence"
                        key={`${event.date}-${event.time}-${event.group}`}
                      >
                        <Tag color={event.kind === 'Экзамен' ? 'blue' : 'green'}>
                          {formatScheduleDate(event.date)} · {event.time}
                          {event.location ? ` · ауд. ${event.location}` : ''}
                        </Tag>
                        {event.group.startsWith('СПС') && <Tag>СПСД</Tag>}
                        {event.group.startsWith('ХОЗ') && <Tag>ХОЗ</Tag>}
                        {event.scheduleChange && (
                          <Tag color="volcano">
                            Перенос времени: было {event.scheduleChange.previousTime}
                          </Tag>
                        )}
                        {event.group.includes('подгруппа') && (
                          <Text>{event.group.split(' · ').slice(1).join(' · ')}</Text>
                        )}
                      </span>
                    ))}
                  </span>
                ) : (
                  <Text className="session-assessment-missing">
                    Занятия: {eventKinds.join(', ')}. Аттестация в расписании не указана.
                  </Text>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    ) : (
      <Text className="session-assessment-missing">Предметы не указаны</Text>
    )
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
          colorPrimary: '#144E9D',
          colorPrimaryHover: '#0A3470',
          colorPrimaryActive: '#0A3470',
          colorLink: '#144E9D',
          colorLinkHover: '#0A3470',
          colorInfo: '#3076AF',
          colorSuccess: '#2F855A',
          colorWarning: '#B7791F',
          colorWarningText: '#8A4B08',
          colorWarningTextHover: '#8A4B08',
          colorWarningTextActive: '#8A4B08',
          colorError: '#C53030',
          colorText: '#1A202C',
          colorTextSecondary: '#4A5568',
          colorBgLayout: '#F5F7FA',
          colorBgContainer: '#FFFFFF',
          colorBorder: '#E3E8EF',
          colorBorderSecondary: '#E3E8EF',
          controlOutline: '#3076AF',
          controlOutlineWidth: 2,
          borderRadius: 8,
          fontFamily:
            '"Segoe UI", Roboto, Arial, sans-serif',
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
              Расписание занятий и аттестаций, сведения о требованиях по
              предметам и источники информации. Данные, которые еще нужно
              подтвердить, отмечены отдельно.
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
          <ScheduleGroupSelector
            onChange={handleGroupChange}
            selectedGroup={selectedGroup}
          />
        )}

        {!isSubjectPath && !isSchedulePath && (
          <section aria-labelledby="today-brief-title" className="today-brief">
            <div className="today-brief-heading">
              <Text className="section-kicker">СЕГОДНЯ · ГРУППА {selectedGroup}</Text>
              <Title id="today-brief-title" level={2}>
                Сегодня, {todayLabel}
              </Title>
              <Text className="today-clock">
                <ClockCircleOutlined /> Сейчас {currentTimeLabel}
              </Text>
              <Tag color={hasOfficialSchedule ? 'green' : 'gold'}>
                {hasOfficialSchedule ? 'Официальное расписание' : 'Предварительные сведения'}
              </Tag>
            </div>
            <div aria-live="polite" className="today-brief-content">
              {todayAgendaItems.length > 0 ? (
                <>
                  <Text strong>План на сегодня</Text>
                  {todayAgendaItems.map((event) => (
                    <div className="today-agenda-item" key={event.key}>
                      <Text className="today-agenda-time">
                        {event.time || event.kind}
                      </Text>
                      <div className="today-agenda-copy">
                        <div className="today-agenda-title">
                          <Text strong>{event.subject}</Text>
                          {event.changeNotice && (
                            <Tag color="volcano">Перенос времени</Tag>
                          )}
                          {event.status && (
                            <Tag color={event.status === 'Сейчас идет' ? 'green' : 'blue'}>
                              {event.status}
                            </Tag>
                          )}
                        </div>
                        {event.detail && <Text>{event.detail}</Text>}
                        {event.changeNotice && (
                          <Text className="schedule-change-notice">{event.changeNotice}</Text>
                        )}
                        {(event.instructor || event.group || event.location) && (
                          <Text type="secondary">
                            {[event.instructor, event.group, event.location]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <Text className="today-brief-empty">
                  {hasOfficialSchedule
                    ? 'Сегодня по опубликованному расписанию учебных мероприятий нет.'
                    : 'На сегодня учебные мероприятия в предварительных сведениях не указаны.'}
                </Text>
              )}
              <Text className="today-current-status">{currentMomentSummary}</Text>
              {nextKnownEvent ? (
                <div className="today-next-event">
                  <Text className="today-next-label">Ближайшее далее</Text>
                  <Text strong>
                    {formatScheduleDate(nextKnownEvent.date)} · {nextKnownEvent.kind}
                  </Text>
                  <Text type="secondary">{nextKnownEvent.detail}</Text>
                </div>
              ) : !todayAgendaItems.length ? (
                <Text type="secondary">Ближайшие даты пока не указаны.</Text>
              ) : null}
            </div>
          </section>
        )}

        {!isSubjectPath && !isSchedulePath && (
          <section className="schedule-panel" aria-labelledby="schedule-title">
            <div className="schedule-heading">
              <div className="schedule-title-wrap">
                <span className="schedule-icon">
                  <CalendarOutlined />
                </span>
                <div>
                  <Text className="section-kicker">4 КУРС · 7 СЕМЕСТР · ОСЕНЬ 2026</Text>
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
                <a
                  className="schedule-full-link"
                  download="user-guide-session-schedule.pdf"
                  href="/user-guide-session-schedule.pdf"
                >
                  <FileTextOutlined /> Руководство пользователя
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
                  ? `${officialScheduleSource} Выберите группу, чтобы отфильтровать расписание.`
                  : 'Пока известны только предварительные даты. Предметы, группы и время еще не подтверждены.'
              }
              showIcon
              type={hasOfficialSchedule ? 'success' : 'warning'}
            />
            <Text className="session-range">
              Физически 5-я сессия (4 курс, 7 семестр): с {formatScheduleDate(sessionRange.start)} по{' '}
              {formatScheduleDate(sessionRange.end)}
            </Text>
            <ScheduleKindSelector
              kinds={calendarEventKinds}
              onChange={handleEventKindsChange}
              selectedKinds={activeEventKinds}
            />
            <div className="calendar-layout">
              <CalendarGrid
                events={visibleCalendarEvents}
                onSelectDate={setSelectedDate}
                selectedDate={selectedDate}
                showEventKinds
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
                        {event.changeNotice && (
                          <Tag color="volcano">{event.changeNotice}</Tag>
                        )}
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
                      {event.changeNotice && (
                        <Text className="schedule-change-notice">{event.changeNotice}</Text>
                      )}
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
            <Text className="section-kicker">4 КУРС · 7 СЕМЕСТР · ОСЕНЬ 2026</Text>
              <Title id="session-overview-title" level={2}>
                Что в сессии
              </Title>
              <Text type="secondary">
                СПСД и ХОЗ отмечены рядом с соответствующими предметами.
              </Text>
            </div>
            <div className="session-overview-grid">
              <article className="session-overview-item">
                <div className="session-overview-item-heading">
                  <Title level={3}>Экзамены</Title>
                  <Tag color="blue">{examSubjects.length}</Tag>
                </div>
                {renderSessionSubjects(examSubjects, 'assessment')}
              </article>

              <article className="session-overview-item">
                <div className="session-overview-item-heading">
                  <Title level={3}>Зачеты</Title>
                  <Tag color="green">{creditSubjects.length}</Tag>
                </div>
                {renderSessionSubjects(creditSubjects, 'assessment')}
              </article>

              <article className="session-overview-item">
                <div className="session-overview-item-heading">
                  <Title level={3}>Дисциплины без указанной аттестации</Title>
                </div>
                {renderSessionSubjects(noAssessmentSubjects, 'noAssessment')}
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
              <Text className="section-kicker">4 КУРС · 7 СЕМЕСТР · ОСЕНЬ 2026</Text>
            <Title id="expanded-schedule-title" level={2}>
              Полное расписание
            </Title>
            <ScheduleGroupSelector
              onChange={handleGroupChange}
              selectedGroup={selectedGroup}
            />
            <ScheduleKindSelector
              kinds={calendarEventKinds}
              onChange={handleEventKindsChange}
              selectedKinds={activeEventKinds}
            />
            <div className="week-toolbar">
              <div>
                <Text className="section-kicker">НЕДЕЛЬНОЕ РАСПИСАНИЕ</Text>
                <Title level={3}>
                  {formatScheduleDate(weekStart)} - {formatScheduleDate(weekEnd)}
                </Title>
              </div>
              <div className="week-navigation">
                <button
                  aria-label="Предыдущая неделя"
                  className="week-nav-button"
                  onClick={() => changeWeek(-1)}
                  type="button"
                >
                  <ArrowLeftOutlined />
                  <span>Предыдущая</span>
                </button>
                <button
                  className="week-today-button"
                  onClick={() => setWeekStart(getWeekStart(today))}
                  title={`Перейти к текущей неделе: ${formatScheduleDate(getWeekStart(today))} - ${formatScheduleDate(addDays(getWeekStart(today), 6))}`}
                  type="button"
                >
                  <CalendarOutlined />
                  Текущая неделя
                </button>
                <button
                  aria-label="Следующая неделя"
                  className="week-nav-button"
                  onClick={() => changeWeek(1)}
                  type="button"
                >
                  <span>Следующая</span>
                  <ArrowRightOutlined />
                </button>
                <button
                  className="week-download-button"
                  disabled={isPdfLoading}
                  onClick={() => void handleDownloadWeekPdf()}
                  type="button"
                >
                  <DownloadOutlined />
                  {isPdfLoading ? 'Готовим PDF...' : 'Скачать PDF недели'}
                </button>
              </div>
            </div>
            {pdfError && (
              <Alert
                className="week-pdf-error"
                title={pdfError}
                showIcon
                type="error"
              />
            )}
            {hasOfficialSchedule ? (
              weekScheduleEvents.length > 0 ? (
                <WeekCalendar events={weekScheduleEvents} weekStart={weekStart} />
              ) : (
                <Empty description="На этой неделе по выбранным фильтрам событий нет">
                  <Text type="secondary">
                    Попробуйте выбрать другую неделю или изменить фильтры.
                  </Text>
                </Empty>
              )
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
                <Text className="section-kicker">
                  {isScheduleOnlySubject ? 'РАСПИСАНИЕ ПРЕДМЕТА' : 'СТРАНИЦА ПРЕДМЕТА'}
                </Text>
                <Title id="subjects-title" level={2}>
                  {selectedSubject.name}
                </Title>
                <Text type="secondary">
                  {isScheduleOnlySubject
                    ? 'Дополнительная информация о курсе в проекте пока не добавлена.'
                    : 'Информация о курсе и материалы'}
                </Text>
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

          {isSubjectPath && !selectedSubject && !selectedScheduleSubjectName ? (
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
                      <Tag
                        color={
                          subject.assessment.type === 'Экзамен'
                            ? 'blue'
                            : subject.assessment.type === 'Зачет'
                              ? 'green'
                              : 'default'
                        }
                      >
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

                    {!isScheduleOnlySubject && <div className="subject-overview-sections">
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
                            <div className="portal-link-row">
                              <a
                                className="detail-link"
                                href={subject.portalUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Учебный портал БГУ
                              </a>
                            </div>
                            {subject.portalNote && (
                              <Text className="detail-link-note">
                                {subject.portalNote}
                              </Text>
                            )}
                            {subject.courseEnrollmentCode && (
                              <div className="course-enrollment-code">
                                <button
                                  aria-expanded={isEnrollmentCodeVisible}
                                  className="course-code-toggle"
                                  onClick={() => {
                                    setIsEnrollmentCodeVisible((visible) => !visible)
                                    setEnrollmentCodeCopyStatus('')
                                  }}
                                  type="button"
                                >
                                  {isEnrollmentCodeVisible ? (
                                    <EyeInvisibleOutlined />
                                  ) : (
                                    <EyeOutlined />
                                  )}
                                  {isEnrollmentCodeVisible
                                    ? 'Скрыть кодовое слово'
                                    : 'Показать кодовое слово'}
                                </button>
                                {isEnrollmentCodeVisible && (
                                  <div className="course-code-value">
                                    <code>{subject.courseEnrollmentCode}</code>
                                    <button
                                      aria-label="Скопировать кодовое слово для записи на курс"
                                      className="course-code-copy"
                                      onClick={async () => {
                                        const enrollmentCode = subject.courseEnrollmentCode
                                        if (!enrollmentCode) return

                                        try {
                                          await navigator.clipboard.writeText(
                                            enrollmentCode,
                                          )
                                          setEnrollmentCodeCopyStatus('Кодовое слово скопировано')
                                        } catch (error) {
                                          setEnrollmentCodeCopyStatus(
                                            `Не удалось скопировать код: ${error instanceof Error ? error.message : String(error)}`,
                                          )
                                        }
                                      }}
                                      title="Скопировать кодовое слово"
                                      type="button"
                                    >
                                      <CopyOutlined />
                                    </button>
                                  </div>
                                )}
                                {enrollmentCodeCopyStatus && (
                                  <Text
                                    aria-live="polite"
                                    className="course-code-copy-status"
                                    role="status"
                                  >
                                    {enrollmentCodeCopyStatus}
                                  </Text>
                                )}
                              </div>
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
                    </div>}

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
                        </div>
                        <ScheduleGroupSelector
                          onChange={handleGroupChange}
                          selectedGroup={selectedGroup}
                        />
                        <ScheduleKindSelector
                          kinds={calendarEventKinds}
                          onChange={handleEventKindsChange}
                          selectedKinds={activeEventKinds}
                        />
                        {subjectSchedule.length > 0 ? (
                          <>
                            <div
                              aria-label="Обозначения типов занятий и аттестации"
                              className="subject-schedule-legend"
                            >
                              {subjectScheduleKinds.map((kind) => (
                                <span className="subject-schedule-legend-item" key={kind}>
                                  <span
                                    aria-hidden="true"
                                    className={`calendar-event-marker calendar-event-marker--${getScheduleEventKindStyle(kind).className}`}
                                  />
                                  {kind}
                                </span>
                              ))}
                            </div>
                            <div className="subject-calendar-layout">
                              <CalendarGrid
                                events={subjectCalendarEvents}
                                onSelectDate={setSelectedSubjectDate}
                                selectedDate={effectiveSubjectDate}
                                showEventKinds
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
                                      <Tag
                                        className="subject-event-kind"
                                        color={getScheduleEventKindStyle(event.kind).tagColor}
                                      >
                                        {event.kind}
                                      </Tag>
                                    </div>
                                    <Text strong>{event.time}</Text>
                                    {event.scheduleChange && (
                                      <Tag color="volcano">
                                        Перенос времени: было {event.scheduleChange.previousTime}
                                      </Tag>
                                    )}
                                    {event.group && <Text>{event.group}</Text>}
                                    {event.instructor && <Text>{event.instructor}</Text>}
                                    {event.location && <Text>{event.location}</Text>}
                                    {event.preparation && (
                                      <div className="subject-preparation">
                                        <Text strong>Подготовить</Text>
                                        <Text>{event.preparation}</Text>
                                      </div>
                                    )}
                                  </article>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <Text className="empty-detail">
                            В предоставленном расписании занятия по этому предмету не указаны.
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

                    {selectedSubject && !isScheduleOnlySubject && <div className="subject-sections">
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
