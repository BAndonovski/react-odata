const COMPARISON_OPERATORS = ['eq', 'ne', 'gt', 'ge', 'lt', 'le'];
const LOGICAL_OPERATORS = ['and', 'or', 'not'];
const COLLECTION_OPERATORS = ['any', 'all'];

export function buildQueryString({ select, filter, groupBy, orderBy, top, skip, count, expand } = {}) {
  const builtFilter = buildFilter(filter)

  if (groupBy) {
    const params = {};
    const applyParams = [];

    if (builtFilter) {
      applyParams.push(`filter(${builtFilter})`)
    }

    // TODO: Support `groupBy` subproperties using '/' or '.'
    applyParams.push(`groupby((${groupBy}),aggregate(Id with countdistinct as Total))`)

    params.$apply = applyParams.join('/');

    if (orderBy) {
      params.$orderby = orderBy
    }

    return Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
  } else {
    const params = {};

    if (select) {
      params.$select = select
    }

    if (builtFilter) {
      params.$filter = builtFilter
    }

    if (orderBy) {
      params.$orderby = orderBy
    }

    if (top) {
      params.$top = top
    }

    if (skip) {
      params.$skip = skip
    }

    if (count) {
      params.$count = true
    }

    if (expand) {
      // TODO: Seperate and built out based on dotted notation 'Foo.Bar.Baz' => '$expand=Foo($expand=Bar($expand=Baz))
      // example: $expand=Source,SourceType,Site,Customer,Status,Tasks,Tasks($expand=AssignedUser),Tasks($expand=AssignedGroup),Tasks($expand=Status)
      params.$expand = expand
    }

    return Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
  }
}

function buildFilter(filters = {}, propPrefix = '') {
  if (typeof(filters) === 'string') {
    return filters;
  } else if (Array.isArray(filters)) {
    return filters.map(f => buildFilter(f, propPrefix)).join(' and ');
  } else if (typeof(filters) === 'object') {
    const filtersArray = Object.keys(filters).reduce((result, filterKey) => {
      const value = filters[filterKey];
      const propName = propPrefix ? `${propPrefix}/${filterKey}` : filterKey;

      if (Array.isArray(value)) {
        result.push(`(${value.map(v => buildFilter(v, propPrefix)).join(` ${filterKey} `)})`)
      } else if (typeof(value) === "number" || typeof(value) === "string" || value instanceof Date) {
        // Simple key/value handled as equals operator
        result.push(`${propName} eq ${handleValue(value)}`) 
      } else if (value instanceof Object) {
        const operators = Object.keys(value);
        operators.forEach(op => {
          if ([...COMPARISON_OPERATORS, ...LOGICAL_OPERATORS].includes(op)) {
            result.push(`${propName} ${op} ${handleValue(value[op])}`) 
          } else if (COLLECTION_OPERATORS.includes(op)) {
            const lambaParameter = propName[0].toLowerCase();
            result.push(`${propName}/${op}(${lambaParameter}:${buildFilter(value, lambaParameter)})`) 
          } else {
            // single boolean function
            result.push(`${op}(${propName}, ${handleValue(value[op])})`) 
          }
        })
      } else {
        throw new Error(`Unexpected value type: ${value}`)
      }

      return result;
    }, [])

    return filtersArray.join(' and ');
  } else {
    throw new Error(`Unexpected filters type: ${filters}`)
  }
}

function handleValue(value) {
  if (typeof(value) === 'string') {
    return `'${value}'`
  } else if (value instanceof Date) {
    const isoString = value.toISOString();
    return isoString.split('.')[0] + "Z"; // strip microseconds
  } else {
    // TODO: Figure out how best to specify types.  See: https://github.com/devnixs/ODataAngularResources/blob/master/src/odatavalue.js
    return value
  }
}