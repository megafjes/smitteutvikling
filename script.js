dayjs.locale('nb')

const ntnuBlue = "#00509e"

const ntnuSupportColors = ["#bcd025", "#6096d0", "#ef8114", "#b01b81", "#f7d019", "#482776", "#3cbfbe", "#cfb887"]
const ntnuSupportColorsLight = ["#d5df7c", "#9db7e1", "#f4ac67", "#c871ac", "#fbdf7b", "#7f619c", "#97d2d4", "#e0d0af"]
const ntnuSupportColorsLighter = ["#ebf0c4", "#cfdaf1", "#fdd9b5", "#e3bcda", "#fdf0c4", "#beafd0", "#d1eaeb", "#eee5d5"]

const startDate = new Date(2020, 8, 1)

const w = 700
const h = 300
const margin = { top: 50, bottom: 25, left: 5, right: 60 }
const colorOfBad = "#b01b81"

let maxOverall = {}

const x = d3.scaleTime()
  .domain([startDate, d3.timeDay.offset(new Date().setHours(0,0,0,0), 1)])
  .rangeRound([margin.left, w - margin.right])

const bandwidth = (x(d3.timeDay.offset(startDate, 1)) - x(startDate)) * 0.8

const severityLevels = ['0', '1', '2-3', '4-7', '8+']

const colorScaleHeat = d3.scaleOrdinal()
  .domain(severityLevels)
  .range([d3.interpolateBlues(0.1), ...d3.schemeOrRd[5].slice(1)])

const emptyTimeline = d3.timeDays(startDate, new Date()).map(d => {
  return { 
    date: d, 
    value: 0, 
    label: dayjs(new Date(d)).format('D MMMM')
  }
})

prepare = (data) => {
  let students = data.filter(d => d["Gruppe"].toUpperCase() == "STUDENTER")
  let employees = data.filter(d => d["Gruppe"].toUpperCase() == "ANSATTE")
  const studentSum = d3.sum(students, d => d["Smittede"])
  const employeeSum = d3.sum(employees, d => d["Smittede"])
  
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
  
  // maxPerDay = students.max > employees.max ? students.max : employees.max
  // maxPerDay = maxPerDay > 0 ? maxPerDay : 1
  
  return {
    studenter: students.timeline,
    ansatte: employees.timeline,
    studenterSum: studentSum,
    ansatteSum: employeeSum,
    studenterMaxPerDay: students.max > 0 ? students.max : 1,
    ansatteMaxPerDay: employees.max > 0 ? employees.max : 1
  }
}

getFacultiesTrondheim = data => {
  return [...new Set(data
    .filter(d => d["By"].toUpperCase() == "TRONDHEIM")
    .map(d => d["Avdeling"]))]
    .reduce((result, item) => {
      if (item) {
        result[item.toUpperCase()] = prepare(data
          .filter(d => d["Avdeling"].toUpperCase() == item.toUpperCase() && d["By"] == "Trondheim"))
      }
      return result
    }, {})
}

calculateHeight = (data, group) => {
  const maxChartHeight = h - margin.top - margin.bottom
  const reqChartHeight = maxChartHeight * data[1][`${group}MaxPerDay`] / d3.max([maxOverall[group], 10])
  return reqChartHeight + margin.top + margin.bottom
}

getMonthInNorwegian = date => {
  const month = dayjs(new Date(date)).format('MMM')
  return month.substring(0,1).toUpperCase() + month.substring(1)
}

drawSection = (cityDiv, data, group) => {
  const requiredHeight = calculateHeight(data, group)

  const y = d3.scaleLinear()
    .domain([0, data[1][`${group}MaxPerDay`]])
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
      .attr('fill', ntnuBlue)
      .attr('x', d => x(d.date))
      .attr('y', d => y(d.value))
      .attr('height', d => y(0) - y(d.value))
      .attr('width', bandwidth)

  const calculateTicks = (maxPerDay, maxOverall) => {
    if (maxOverall >= 4) {
      return maxPerDay/maxOverall * 4
    } else if (maxOverall >= 2) {
      return maxPerDay/maxOverall * 2
    } else return maxPerDay/maxOverall
  }

  svg.append('g') // cases
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisRight(y).ticks(calculateTicks(data[1][`${group}MaxPerDay`], maxOverall[group]))
      .tickSize(w - margin.left - margin.right))
    .call(g => g.select(".domain")
      .remove())
    .call(g => g.select('.tick')
      .remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke-opacity", 0.5)
      .attr("stroke-dasharray", "2,2"))
    .call(g => g.selectAll(".tick text")
      .attr("x", w - margin.right - margin.left + 10)
      .style('font-family', "'Open Sans', sans-serif")
      .style('font-size', 'small')
      .style('font-weight', 300)
      .text(d => d))

  svg.append('g') // months
    .attr('transform', `translate(0 ,${requiredHeight - margin.bottom})`)
    .call(d3.axisBottom(x)
      .ticks(d3.timeMonth.every(1), '%m/%d/%y'))
    .call(g => g.selectAll(".tick text")
      .attr('text-anchor', 'start')
      .style('font-family', "'Open Sans', sans-serif")
      .style('font-size', 'small')
      .style('font-weight', 300)
      .text(d => getMonthInNorwegian(d)))

  svg.append('text')
    .attr('x', margin.left)
    .attr('y', margin.top - 30)
    .style('font-family', "'Open Sans', sans-serif")
    .style('font-weight', 600)
    .text(`${data[0]}, ${group}`)

  svg.append('text')
    .attr('x', margin.left)
    .attr('y', margin.top - 15)
    .style('font-family', "'Open Sans', sans-serif")
    .style('font-size', 'small')
    .style('font-weight', 300)
    .text(`Totalt antall innmeldt smittede:`)

  svg.append('text')
    .attr('x', margin.left + 188)
    .attr('y', margin.top - 15)
    .style('font-family', "'Open Sans', sans-serif")
    .style('font-size', 'small')
    .style('font-weight', 600)
    .text(data[1][`${group}Sum`])
}

numberToColor = num => {
  if (num >= 8) {
    return colorScaleHeat('8+')
  } else if (num >= 4) {
    return colorScaleHeat('4-7')
  } else if (num >= 2) {
    return colorScaleHeat('2-3')
  } else if (num == 1) {
    return colorScaleHeat('1')
  } else return colorScaleHeat('0')
}

drawHeatmap = (div, data, group) => {
  const svg = div.append('svg')
    .attr('viewBox', `0 0 ${w} 12`)

  svg.selectAll('rect')
    .data(data[1][group]).enter()
    .append('rect')
      .attr('x', d => x(d.date))
      .attr('y', 0)
      .attr('height', 12)
      .attr('width', bandwidth)
      .attr('fill', d => numberToColor(d.value))
  
  // svg.append('line')
  //   .attr('x1', margin.left)
  //   .attr('y1', 11)
  //   .attr('x2', w - margin.right)
  //   .attr('y2', 11)
  //   .attr('stroke', 'gray')

  svg.append('text')
    .attr('x', w - margin.right + 10)
    .attr('y', 11)
    .style('font-family', "'Open Sans', sans-serif")
    .style('font-size', 'small')
    .style('font-weight', 300)
    .text(`${data[0]}:`)

  svg.append('text')
    .attr('text-anchor', 'end')
    .attr('x', w )
    .attr('y', 11)
    .style('font-family', "'Open Sans', sans-serif")
    .style('font-size', 'small')
    .style('font-weight', 300)
    .text(data[1][`${group}Sum`])

  svg.append('rect')
    .attr('x', margin.left)
    .attr('y', 0.5)
    .attr('width', w - margin.right - margin.left)
    .attr('height', 11)
    .attr('stroke', 'black')
    .attr('stroke-width', 0.5)
    .attr('fill', 'none')
}

drawLegend = (div) => {
  const svg = div.append('svg')
    .attr('viewBox', `0 0 ${w} 40`)

  svg.append('text')
    .attr('x', margin.left)
    .attr('y', 30)
    .style('font-family', "'Open Sans', sans-serif")
    .style('font-size', 'medium')
    .style('font-weight', 600)
    .text(`Per fakultet:`)

  const legendBoxWidth = 30

  svg.selectAll('text .legend')
    .data(severityLevels).enter()
    .append('text')
      .attr('text-anchor', 'middle')
      .attr('x', (d, i) => w - margin.right - legendBoxWidth*(4.5-i))
      .attr('y', 19)
      .style('font-family', "'Open Sans', sans-serif")
      .style('font-size', 'small')
      .style('font-weight', 300)
      .text(d => {
        return d
      })

  svg.selectAll('rect')
    .data(severityLevels).enter()
    .append('rect')
      .attr('x', (d, i) => w - margin.right - legendBoxWidth*(5-i))
      .attr('y', 23)
      .attr('width', legendBoxWidth)
      .attr('height', 10)
      .attr('fill', d => colorScaleHeat(d))


  svg.append('rect')
    .attr('x', w - margin.right - legendBoxWidth*5)
    .attr('y', 23)
    .attr('width', legendBoxWidth*5)
    .attr('height', 10)
    .attr('stroke', 'black')
    .attr('stroke-width', 0.5)
    .attr('fill', 'none')
}

drawChart = (data, group, cssSelector) => {
  
  Object.entries(data).forEach(d => {
    const cityDiv = d3.select(cssSelector)
      .style('min-width', '496px')
      .style('max-width', '914px')
      // .style('border-bottom', '0.5px solid gray')
      .style('margin-bottom', '150px')
      // .style('margin', 'auto')
      .append('div')
        .classed('city-div', true)
        .classed(group, true)
        .classed(d[0].toLowerCase(), true)
        .style('margin-bottom', '45px')
        // .style('padding', '15px 10px')

    cityDiv.on('click', () => {
      const more = d3.select(`div.${group}Drilldown`)
      if (more.style('display') == "block") {
        more.style('display', 'none')
      } else {
        more.style('display', 'block')
      }
    })

    cityDiv.on('mouseover', () => {
      d3.select(`.city-div.trondheim.${group}`).style('cursor', 'pointer')
    })

    drawSection(cityDiv, d, group)
    if (d[1].fak) {
      const faculties = Object.entries(d[1].fak)
        .filter(f => f[1][`${group}Sum`])
        .sort((a,b) => b[1][`${group}Sum`] - a[1][`${group}Sum`])
      const heatmapColorScale = d3.scaleLinear()
        .domain([0, d3.max(faculties, f => f[1][`${group}MaxPerDay`])])
        .range(["white", colorOfBad])
  
      const facDiv = cityDiv.append('div')
        .classed(`${group}Drilldown`, true)
        .style('display', 'none')

      drawLegend(facDiv)

      faculties.forEach(f => {
        drawHeatmap(facDiv, f, group)
      })

      facDiv.append('svg')
        .attr('viewBox', `0 0 ${w} 28`)
        .append('g') // months
          .attr('transform', `translate(0 , 5)`)
          .call(d3.axisBottom(x)
            .ticks(d3.timeMonth.every(1), '%m/%d/%y'))
          .call(g => g.selectAll(".tick text")
            .attr('text-anchor', 'start')
            .style('font-family', "'Open Sans', sans-serif")
            .style('font-size', 'small')
            .style('font-weight', 300)
            .text(d => getMonthInNorwegian(d)))
    }
  })
}

(async () => await d3.dsv(';', "https://www.ntnu.no/assets/visualization/2020/covid19stats.csv")
// (async () => await d3.csv("https://docs.google.com/spreadsheets/d/1m1jLMrbYZXM-aiX5dyBizJNO4BuolIYQvOoCbMJAim4/gviz/tq?tqx=out:csv")
  .then(data => {

    dataNtnu = ({
      "Trondheim": Object.assign(prepare(data.filter(d => d["By"] == "Trondheim")), 
        { "fak": getFacultiesTrondheim(data) }),
      "Gjøvik": prepare(data.filter(d => d["By"] == "Gjøvik")),
      "Ålesund": prepare(data.filter(d => d["By"] == "Ålesund")),
    })

    console.log(dataNtnu)
    
    maxOverall.studenter = d3.max([...Object.values(dataNtnu).map(d => d['studenterMaxPerDay'])])
    maxOverall.ansatte = d3.max([...Object.values(dataNtnu).map(d => d['ansatteMaxPerDay'])])

    drawChart(dataNtnu, 'studenter', '#studentsChart')

    drawChart(dataNtnu, 'ansatte', '#employeesChart')
    
  }))()

