dayjs.locale('nb')

const ntnuBlue = "#00509e"

const ntnuSupportColors = ["#bcd025", "#6096d0", "#ef8114", "#b01b81", "#f7d019", "#482776", "#3cbfbe", "#cfb887"]
const ntnuSupportColorsLight = ["#d5df7c", "#9db7e1", "#f4ac67", "#c871ac", "#fbdf7b", "#7f619c", "#97d2d4", "#e0d0af"]
const ntnuSupportColorsLighter = ["#ebf0c4", "#cfdaf1", "#fdd9b5", "#e3bcda", "#fdf0c4", "#beafd0", "#d1eaeb", "#eee5d5"]

const startDate = new Date(2020, 9, 1)

const xScale = d3.scaleTime()
  .domain([startDate, new Date().setHours(0, 0, 0)])
  .range([0, 200])

const emptyTimeline = d3.timeDays(startDate, new Date()).map(d => {
  return { 
    date: d, 
    value: 0, 
    label: dayjs(new Date(d)).format('D MMMM'), 
  }
})

prepare = (data) => {
  let students = data.filter(d => d["Gruppe"] == "Studenter")
  let employees = data.filter(d => d["Gruppe"] == "Ansatte")
  const studentSum = d3.sum(students, d => d["Smittede"])
  const employeeSum = d3.sum(employees, d => d["Smittede"])
  let maxPerDay
  
  const shownAndFormat = (group) => {
    const filtered = group.map(d => ({ date: new Date(d["Dato"]).getTime(), value: d["Smittede"] }))
    
    const rolluped = d3.rollup(filtered, d => d3.sum(d, v => v.value), d => d.date)
    
    const max = rolluped.size ? d3.max([...rolluped], d => d[1]) : 0
    
    return {
      timeline: emptyTimeline.map(d => {
        const value = rolluped.get(d.date.getTime())
        return { ...d, value: value ? value : 0 }}),
      max: max
    }
  }
  
  students = shownAndFormat(students)
  employees = shownAndFormat(employees)
  
  maxPerDay = students.max > employees.max ? students.max : employees.max
  maxPerDay = maxPerDay > 0 ? maxPerDay : 1
  
  return {
    students: students.timeline,
    employees: employees.timeline,
    studentSum: studentSum,
    employeeSum: employeeSum,
    maxPerDay: maxPerDay
  }
}

getFacultiesTrondheim = data => {
  [...new Set(data.filter(d => d["By"] == "Trondheim").map(d => d["Avdeling"]))].reduce((result, item) => {
    if (item) {
      result[item] = prepare(data.filter(d => d["Avdeling"] == item && d["By"] == "Trondheim"))
    }
    return result
  }, {})
}

drawChart = (data, group) => {
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(Object.values(data).map(d => d.maxPerDay))])
    .range([39, 1])

  const area = d3.area()
    .x(d => xScale(d.date))
    .y1(d => yScale(d.value))
    .y0(d => yScale(0))

  const line = area.lineY1()

  const chart = d3.select("#chart")
  
  Object.entries(data).forEach(d => {
    const section = chart.append('section')
    section.append('div')
      .classed('city', true)
      .text(d[0])

    const svg = section.append('div')
      .classed('svg', true)
      .append('svg')
        .attr('viewBox', '0 0 200 40')

    section.append('div')
      .classed('total', true)
      .text(d3.sum(d[1][group].map(r => r.value)))

    svg.append('path')
      .attr('d', area(d[1][group]))
      .attr('fill', ntnuSupportColorsLighter[1])
    
    svg.append('path')
      .attr('d', line(d[1][group]))
      .attr('fill', 'none')
      .attr('stroke', ntnuBlue)
  })

}

// Swap in: https://www.ntnu.no/assets/visualization/2020/covid19stats.csv
(async () => await d3.csv("https://docs.google.com/spreadsheets/d/1m1jLMrbYZXM-aiX5dyBizJNO4BuolIYQvOoCbMJAim4/gviz/tq?tqx=out:csv")
  .then(data => {

    dataNtnu = ({
      "Trondheim": Object.assign(prepare(data.filter(d => d["By"] == "Trondheim")), 
        { "fak": getFacultiesTrondheim(data) }),
      "Gjøvik": prepare(data.filter(d => d["By"] == "Gjøvik")),
      "Ålesund": prepare(data.filter(d => d["By"] == "Ålesund")),
    })

    drawChart(dataNtnu, 'students')
    
  }))()
