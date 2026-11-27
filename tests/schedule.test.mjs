import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { createServer } from 'vite'

let server
let officialSchedule
let publicSubjects
let isScheduleEventVisible

before(async () => {
  server = await createServer({ configFile: './vite.config.ts', server: { middlewareMode: true }, appType: 'custom' })
  ;({ officialSchedule } = await server.ssrLoadModule('/src/data/officialSchedule.ts'))
  ;({ publicSubjects } = await server.ssrLoadModule('/src/data/publicSubjects.ts'))
  ;({ isScheduleEventVisible } = await server.ssrLoadModule('/src/data/scheduleVisibility.ts'))
})

after(async () => {
  await server?.close()
})

const matchingEvents = (date, subject, kind) =>
  officialSchedule.filter((event) =>
    event.date === date && event.subject === subject && (!kind || event.kind === kind),
  )

describe('schedule v05 data and dependent views', () => {
  it('keeps the explicit user resolutions and v05 additions', () => {
    assert.deepEqual(matchingEvents('2026-11-25', 'Семейное право', 'Экзамен').map(({ time, location, scheduleChange }) =>
      [time, location, scheduleChange?.previousTime, scheduleChange?.previousLocation],
    ), [['08:30', '510', '09:30', '607']])
    assert.deepEqual(matchingEvents('2026-11-28', 'Международное частное право', 'Экзамен').map(({ time, location, scheduleChange }) =>
      [time, location, scheduleChange],
    ), [['09:30', '604', undefined]])
    assert.deepEqual(matchingEvents('2026-11-21', 'Международное частное право').filter(({ group }) => group.startsWith('ХОЗ')).map(({ location }) => location), ['316'])
    assert.deepEqual(matchingEvents('2026-11-26', 'Аграрное право', 'Консультация').map(({ time, location }) => [time, location]), [['09:00-09:30', '313']])
    assert.deepEqual(matchingEvents('2026-11-24', 'Семейное право').map(({ time, kind, location, scheduleChange }) =>
      [time, kind, location, scheduleChange?.previousTime, scheduleChange?.previousLocation],
    ), [
      ['08:00', 'Консультация', '407', '08:00-09:20', '606'],
      ['09:30', 'Экзамен', '407', undefined, '606'],
    ])
    assert.deepEqual(matchingEvents('2026-11-25', 'Семейное право', 'Консультация').map(({ location }) => location), ['510'])
    assert.deepEqual(matchingEvents('2026-11-27', 'Уголовный процесс').filter(({ kind }) =>
      kind === 'Консультация' || kind === 'Экзамен',
    ).map(({ time, kind, location, scheduleChange }) =>
      [time, kind, location, scheduleChange?.previousLocation],
    ), [['08:00', 'Консультация', '508', undefined], ['09:00', 'Экзамен', '508', '502']])
    assert.deepEqual(matchingEvents('2026-11-27', 'Международное частное право', 'Консультация').map(({ time, location, scheduleChange }) => [time, location, scheduleChange?.previousTime]), [['14:10-15:30', '312', '12:40-14:00']])
    assert.deepEqual(matchingEvents('2026-11-28', 'Криминология').map(({ time, kind, scheduleChange }) =>
      [time, kind, scheduleChange?.previousTime],
    ), [['11:00', 'Консультация', undefined], ['14:10-15:30', 'Экзамен', '11:00']])
    assert.deepEqual(matchingEvents('2026-12-01', 'Аграрное право').map(({ time, kind, location }) => [time, kind, location]), [['09:00', 'Консультация', '606'], ['09:30', 'Экзамен', '606']])
    assert.deepEqual(matchingEvents('2026-12-05', 'Уголовный процесс').map(({ time, kind, location, scheduleChange }) =>
      [time, kind, location, scheduleChange?.previousTime],
    ), [['12:40', 'Консультация', '407', undefined], ['14:10', 'Экзамен', '407', '12:40']])
  })

  it('includes all v05 room data for 30 November through 5 December without guessing omitted rooms', () => {
    const expectedLocations = new Map([
      ['2026-11-30', ['215', '005', '610', '610', '610', '610']],
      ['2026-12-01', ['606', '606', '309', '309', '216', '215', '309', '216', '215', '309']],
      ['2026-12-02', ['005', '217', '005', '217', '305', '305', '305', '305']],
      ['2026-12-03', ['313', '309', '309', '304', '304']],
      ['2026-12-04', ['502', '305', '305', '309', '309']],
      ['2026-12-05', ['604', '604', '407', '407']],
    ])

    for (const [date, locations] of expectedLocations) {
      const events = officialSchedule.filter((event) => event.date === date)
      assert.deepEqual(events.map(({ location }) => location), locations, date)
      assert.ok(events.every(({ location }) => location), `${date}: every specified location is present`)
    }
  })

  it('applies the same group visibility to calendar, weekly/PDF event sets, assessments and subject events', () => {
    const shared = { group: 'ОБЩ' }
    const sps = { group: 'СПС · 1-я группа' }
    const hoz = { group: 'ХОЗ · 2-я группа' }

    for (const [viewName, events] of [
      ['calendar', [shared, sps, hoz]],
      ['weekly schedule and PDF export', [shared, sps, hoz]],
      ['session assessment overview', [shared, sps, hoz]],
      ['subject page calendar', [shared, sps, hoz]],
    ]) {
      assert.deepEqual(events.filter(({ group }) => isScheduleEventVisible(group, 'СПС')), [shared, sps], `${viewName}: СПС`)
      assert.deepEqual(events.filter(({ group }) => isScheduleEventVisible(group, 'ХОЗ')), [shared, hoz], `${viewName}: ХОЗ`)
      assert.deepEqual(events.filter(({ group }) => isScheduleEventVisible(group, 'ОБЩ')), events, `${viewName}: ОБЩ`)
    }

    const visibleFor = (selectedGroup) =>
      officialSchedule.filter(({ group }) => isScheduleEventVisible(group, selectedGroup))
    const visibleSps = visibleFor('СПС')
    const visibleHoz = visibleFor('ХОЗ')
    const visibleAll = visibleFor('ОБЩ')
    const key = ({ date, time, subject, kind, group }) => [date, time, subject, kind, group].join('|')

    assert.ok(visibleSps.every(({ group }) => group.startsWith('СПС') || group.startsWith('ОБЩ')))
    assert.ok(visibleHoz.every(({ group }) => group.startsWith('ХОЗ') || group.startsWith('ОБЩ')))
    assert.deepEqual(visibleAll, officialSchedule)
    assert.ok(officialSchedule.filter(({ group }) => group.startsWith('ОБЩ')).every((event) =>
      visibleSps.some((candidate) => key(candidate) === key(event)) &&
      visibleHoz.some((candidate) => key(candidate) === key(event)),
    ), 'shared events remain available in both specialized views')

    const familySpsExam = matchingEvents('2026-11-25', 'Семейное право', 'Экзамен')[0]
    const iprHozExam = matchingEvents('2026-11-28', 'Международное частное право', 'Экзамен')[0]
    assert.ok(visibleSps.some((event) => key(event) === key(familySpsExam)))
    assert.ok(!visibleHoz.some((event) => key(event) === key(familySpsExam)))
    assert.ok(visibleHoz.some((event) => key(event) === key(iprHozExam)))
    assert.ok(!visibleSps.some((event) => key(event) === key(iprHozExam)))

    const assessments = (events) =>
      events.filter(({ kind }) => kind === 'Экзамен' || kind === 'Зачет')
    assert.ok(assessments(visibleSps).every(({ group }) => group.startsWith('СПС') || group.startsWith('ОБЩ')))
    assert.ok(assessments(visibleHoz).every(({ group }) => group.startsWith('ХОЗ') || group.startsWith('ОБЩ')))
    assert.equal(assessments(visibleAll).length, assessments(officialSchedule).length)
    assert.ok(assessments(visibleSps).some((event) => key(event) === key(familySpsExam)))
    assert.ok(!assessments(visibleHoz).some((event) => key(event) === key(familySpsExam)))
    assert.ok(assessments(visibleHoz).some((event) => key(event) === key(iprHozExam)))
    assert.ok(!assessments(visibleSps).some((event) => key(event) === key(iprHozExam)))
  })

  it('builds a unique card/page catalog containing every scheduled subject', () => {
    const publicNames = new Set(publicSubjects.map(({ name }) => name))
    const scheduleOnlyNames = [...new Set(officialSchedule.map(({ subject }) => subject))]
      .filter((name) => !publicNames.has(name))
    const catalogNames = [...publicNames, ...scheduleOnlyNames]

    assert.equal(officialSchedule.length, 143)
    assert.equal(new Set(catalogNames).size, catalogNames.length)
    assert.ok([...new Set(officialSchedule.map(({ subject }) => subject))].every((name) => catalogNames.includes(name)))
    assert.ok(officialSchedule.every(({ date, time, kind, subject, group }) => date && time && kind && subject && group))
    const eventKeys = officialSchedule.map(({ date, time, kind, subject, instructor, group }) =>
      [date, time, kind, subject, instructor, group].join('|'),
    )
    assert.equal(new Set(eventKeys).size, eventKeys.length, 'the schedule contains no duplicate events')
  })
})
