// Filter based on https://github.com/wix/corvid-external-db-mysql-adapter/blob/master/service/support/filter-parser.js
const escape = require('sqlutils/pg/escape')
const EMPTY = ''

const parseFilter = filter => {
  if (filter && filter.operator) {
    const parsed = parseInternal(filter)
    return parsed ? `WHERE ${parsed}` : EMPTY
  }
  return EMPTY
}

const parseInternal = filter => {

  if (!filter || filter.operator === undefined) {
    return 'TRUE = TRUE'
  }

  switch (filter.operator) {
    case '$and': {
      const value = filter.value.map(parseInternal).join(' AND ')
      return value ? `(${value})` : value
    }
    case '$or': {
      const value = filter.value.map(parseInternal).join(' OR ')
      return value ? `(${value})` : value
    }
    case '$not': {
      const value = parseInternal(filter.value[0])
      return value ? `NOT (${value})` : value
    }
    case '$ne':
      return `${filter.fieldName} <> ${escape(mapValue(filter.value))}`
    case '$lt':
      return `${filter.fieldName} < ${escape(mapValue(filter.value))}`
    case '$lte':
      return `${filter.fieldName} <= ${escape(mapValue(filter.value))}`
    case '$gt':
      return `${filter.fieldName} > ${escape(mapValue(filter.value))}`
    case '$gte':
      return `${filter.fieldName} >= ${escape(mapValue(filter.value))}`
    case '$hasSome': {
      const list = filter.value
      .map(mapValue)
      .map(date => escape(date, null, null))
      .join(', ')
      return list ? `${filter.fieldName} IN (${list})` : EMPTY
    }
    case '$contains':
      if (!filter.value || (filter.value && filter.value.length === 0)) {
        return ''
      }
      return `${filter.fieldName} LIKE ${escape(`%${filter.value}%`)}`
    case '$urlized': {
      const list = filter.value.map(s => s.toLowerCase()).join('[- ]')
      return list ? `LOWER(${filter.fieldName}) RLIKE '${list}'` : EMPTY
    }
    case '$startsWith':
      return `${filter.fieldName} LIKE ${escape(`${filter.value}%`)}`
    case '$endsWith':
      return `${filter.fieldName} LIKE ${escape(`%${filter.value}`)}`
    case '$eq': {
      return filter.value === null || filter.value === undefined
        ? `${filter.fieldName} IS NULL`
        : `${filter.fieldName} = ${escape(mapValue(filter.value))}`
    }
    default:
      throw new BadRequestError(
        `Filter of type ${filter.operator} is not supported.`
      )
  }
}

const mapValue = value => {
  if (value === null || value === undefined) return null
  const reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/
  if (typeof value === 'object' && '$date' in value) {
    return new Date(value['$date'])
  }
  if (typeof value === 'string') {
    const re = reISO.exec(value)
    if (re) {
      return new Date(value)
    }
  }
  return value
}


const wrapDates = item => {
  Object.keys(item)
  .map(key => {
    if (item[key] instanceof Date) {
      item[key] = { $date: item[key] }
    }
  })

  return item
}

const unwrapDates = item => {
  Object.keys(item)
  .map(key => {
    if (item[key]['$date']) {
      item[key] = item[key]['$date']
    }
  })

  return item
}

module.exports = { parseFilter, wrapDates, unwrapDates }