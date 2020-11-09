dayjs.locale('nb')

const ntnuBlue = "#00509e"

const ntnuSupportColors = ["#bcd025", "#6096d0", "#ef8114", "#b01b81", "#f7d019", "#482776", "#3cbfbe", "#cfb887"]
const ntnuSupportColorsLight = ["#d5df7c", "#9db7e1", "#f4ac67", "#c871ac", "#fbdf7b", "#7f619c", "#97d2d4", "#e0d0af"]
const ntnuSupportColorsLighter = ["#ebf0c4", "#cfdaf1", "#fdd9b5", "#e3bcda", "#fdf0c4", "#beafd0", "#d1eaeb", "#eee5d5"]

const startDate = new Date(2020, 8, 1)

const w = 600
const h = 300
const margin = { top: 50, bottom: 25, left: 5, right: 35 }
const colorOfBad = "#b01b81"

let maxOverall



// const xBand = d3.scaleBand()
//   .domain(d3.timeDays(startDate, new Date().setHours(0,0,0)))
//   .range([margin.left, w - margin.right])
//   .padding(0.1)

const x = d3.scaleTime()
  .domain([startDate, d3.timeDay.offset(new Date(), 0)])
  .rangeRound([margin.left, w - margin.right])

const bandwidth = (x(d3.timeDay.offset(startDate, 1)) - x(startDate)) * 0.8

const emptyTimeline = d3.timeDays(startDate, new Date()).map(d => {
  return { 
    date: d, 
    value: 0, 
    label: dayjs(new Date(d)).format('D MMMM')
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
    studenter: students.timeline,
    ansatte: employees.timeline,
    studenterSum: studentSum,
    ansatteSum: employeeSum,
    maxPerDay: maxPerDay
  }
}

getFacultiesTrondheim = data => {
  return [...new Set(data.filter(d => d["By"] == "Trondheim").map(d => d["Avdeling"]))].reduce((result, item) => {
    if (item) {
      result[item] = prepare(data.filter(d => d["Avdeling"] == item && d["By"] == "Trondheim"))
    }
    return result
  }, {})
}

const calculateHeight = data => {
  const maxChartHeight = h - margin.top - margin.bottom
  const reqChartHeight = maxChartHeight * data[1].maxPerDay / d3.max([maxOverall, 10])
  return reqChartHeight + margin.top + margin.bottom
}

const getMonthInNorwegian = date => {
  const month = dayjs(new Date(date)).format('MMM')
  return month.substring(0,1).toUpperCase() + month.substring(1)
}

const drawSection = (cityDiv, data, group) => {
  const requiredHeight = calculateHeight(data)

  const y = d3.scaleLinear()
    .domain([0, data[1].maxPerDay])
    .range([requiredHeight - margin.bottom, margin.top])

  const area = d3.area()
    .x(d => x(d.date))
    .y1(d => y(d.value))
    .y0(d => y(0))

  const line = area.lineY1()

  const svg = cityDiv.append('svg')
    .classed('city', true)
    .attr('viewBox', `0 0 ${w} ${requiredHeight}`)

  // svg.append('path')
  //   .attr('d', area(d[1][group]))
  //   .attr('fill', ntnuSupportColorsLighter[1])
  
  // svg.append('path')
  //   .attr('d', line(d[1][group]))
  //   .attr('fill', 'none')
  //   .attr('stroke', ntnuBlue)

  svg.selectAll('rect')
    .data(data[1][group]).enter()
    .append('rect')
      .attr('fill', colorOfBad)
      .attr('x', d => x(d.date))
      .attr('y', d => y(d.value))
      .attr('height', d => y(0) - y(d.value))
      .attr('width', bandwidth)

  svg.append('g') // cases
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisRight(y).ticks(data[1]['maxPerDay']/maxOverall * 4)
      .tickSize(w - margin.left - margin.right))
    .call(g => g.select(".domain")
      .remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-dasharray", "2,2"))
    .call(g => g.selectAll(".tick text")
      .attr("x", w - margin.right - margin.left + 10)
      .text(d => d == '0' ? '' : d))

  svg.append('g') // months
    .attr('transform', `translate(0 ,${requiredHeight - margin.bottom})`)
    .call(d3.axisBottom(x)
      .ticks(d3.timeMonth.every(1), '%m/%d/%y'))
    .call(g => g.selectAll(".tick text")
      .attr('text-anchor', 'start')
      .text(d => getMonthInNorwegian(d)))

  svg.append('text')
    .classed('title', true)
    .attr('x', margin.left)
    .attr('y', margin.top - 30)
    .text(data[0])

  svg.append('text')
    .classed('total', true)
    .attr('x', margin.left)
    .attr('y', margin.top - 15)
    .text(`Totalt antall innmeldte smittede ${group}: ${data[1]['studenterSum']}`)
}



const drawHeatmap = (cityDiv, data, group, heatmapColorScale) => {
  svg = cityDiv.append('svg')
    .classed('heat', true)
    .attr('viewBox', `0 0 ${w} 12`)

  svg.selectAll('rect')
    .data(data[1][group]).enter()
    .append('rect')
      .attr('x', d => x(d.date))
      .attr('y', 0)
      .attr('height', 12)
      .attr('width', bandwidth)
      .attr('fill', d => heatmapColorScale(d.value))
  
  // svg.append('line')
  //   .attr('x1', margin.left)
  //   .attr('y1', 11)
  //   .attr('x2', w - margin.right)
  //   .attr('y2', 11)
  //   .attr('stroke', 'gray')

  svg.append('text')
    .classed('fac', true)
    .attr('x', w - margin.right + 10)
    .attr('y', 10)
    .text(data[0])
}

drawChart = (data, group) => {
  

  Object.entries(data).forEach(d => {
    const cityDiv = d3.select('#chart').append('div').classed('city-div', true)


    drawSection(cityDiv, d, group)
    if (d[1].fak) {
      const faculties = Object.entries(d[1].fak).sort((a,b) => b[1]['maxPerDay'] - a[1]['maxPerDay'])
      const heatmapColorScale = d3.scaleLinear()
        .domain([0, d3.max(faculties, f => f[1]['maxPerDay'])])
        .range(["white", colorOfBad])

      faculties.forEach(f => {
        drawHeatmap(cityDiv, f, group, heatmapColorScale)
      })
    }
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

    maxOverall = d3.max([...Object.values(dataNtnu).map(d => d.maxPerDay)])

    drawChart(dataNtnu, 'studenter')
    
  }))()
