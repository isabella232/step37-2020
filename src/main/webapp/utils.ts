// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ProjectGraphData } from './model/project-graph-data';
import { Recommendation } from './model/recommendation';
import { ProjectMetaData } from './model/project-metadata';
import { Project } from './model/project';
import { RecommenderType } from './model/recommender-type';

/** Whether this is a test or not. */
export var defaultIsTest: boolean = true;
export var defaultColors: string[] = ['#3c78d8', '#cc0000', '#ff9900', '#b6d7a8', '#9c27b0'];

/** Used internally to dish out fake responses when requested. Effectively a map from URL to response */
var fakeResponses: { [key: string]: any } = {};

/** Sends the given request to HTTP if isTest is false, otherwise fakes out the request */
export async function request(url: string, method: string, body = undefined, isTest: boolean = defaultIsTest): Promise<{ json: any }> {
  if (isTest) {
    return new Promise(resolve => {
      let response = getFake(url, method);
      // When the user calls json() on the promise, 
      resolve({ json: () => response });
    });
  } else {
    return fetch(url, {
      method: method,
      body: JSON.stringify(body)
    });
  }
}

/** Checks if the two timestamps (millis since epoch) fall on the same day. Returns true if they do */
export function fallOnSameDay(time1: number, time2: number): boolean {
  let date1 = new Date(0);
  date1.setTime(time1);
  let date2 = new Date(0);
  date2.setTime(time2);

  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

/** Returns the recommendations which occured on the same day as the given time, which is in milliseconds since epoch */
function getRecommendations(time: number, dateToRecommendation: { [key: number]: Recommendation }): Recommendation[] {
  let recommendations: Recommendation[] = [];
  for (let [key, value] of Object.entries(dateToRecommendation)) {
    if (fallOnSameDay(time, +key)) {
      recommendations.push(value);
    }
  }
  return recommendations;
}

/** Returns the tooltip associated with the given IAM Bindings time */
function getTooltip(numberBindings: number, matchingRecommendations: Recommendation[]): string {
  // The list of recommendations on the same day
  if (matchingRecommendations.length === 0) {
    return `IAM Bindings: ${numberBindings}`;
  }

  let tooltip = '';
  matchingRecommendations.forEach((recommendation, index) => {
    tooltip += recommendation.description;
    if (index < matchingRecommendations.length - 1) {
      tooltip += '\n';
    }
  });
  return tooltip;
}

/** Returns the point styling associated with the given recommendation */
function getPoint(matchingRecommendations: Recommendation[], color: string): string {
  if (matchingRecommendations.length === 0) {
    return null;
  }
  return `point { size: 10; shape-type: circle; fill-color: ${color}; visible: true; }`;
}

/** Converts the given millis since epoch to the start of the day in the local timezone */
function startOfDay(time: number): Date {
  let date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Extract all the unique days from the given mappings and returns them sorted */
function uniqueDays(graphData: ProjectGraphData[]): Date[] {
  let days: Set<number> = new Set();
  graphData.forEach(data => {
    Object.keys(data.dateToNumberIAMBindings).map(time => startOfDay(+time)).forEach(date => days.add(date.getTime()));
  });

  let out: Date[] = [];
  days.forEach(time => {
    out.push(new Date(time));
  });

  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}

/** Creates the table rows from the given ProjectGraphData The first row contains the column headers */
export function createIamRows(graphData: ProjectGraphData[], colors?: string[]): any[] {
  // First, get all the days we need to add
  let days = uniqueDays(graphData);
  // Each row is [time, data1, data1-tooltip, data1-style, data2, data2-tooltip, ...]
  let rows: any[] = [];
  let rowSize = 1 + graphData.length * 3;

  if (!colors) {
    colors = defaultColors;
  }

  // Add a row for each unique day
  days.forEach(day => rows.push([day]));

  graphData.forEach((data, index) => {
    for (const [key, value] of Object.entries(data.dateToNumberIAMBindings)) {
      // Convert key from string to number
      let date = startOfDay(+key);
      // The row we're adding to is the same index as unique days
      let row = rows[days.findIndex(findDate => findDate.getTime() === date.getTime())];

      let recommendations = getRecommendations(+key, data.dateToRecommendationTaken);
      let tooltip = getTooltip(value, recommendations);
      let point = getPoint(recommendations, colors[index]);

      // Populate the existing row with information
      row.push(value, tooltip, point);
    }
  });

  return rows;
}

/** Creates the column headers for an IAM graph */
export function createIamColumns(graphData: ProjectGraphData[]): any[] {
  let columns: any[] = ['Time'];
  graphData.forEach(data => {
    // Populate the header row, which contains the column purposes
    columns.push(data.projectId, { type: 'string', role: 'tooltip' }, { type: 'string', role: 'style' });
  });
  return columns;
}

export function createIamOptions(graphData: ProjectGraphData[], colors?: string[]): google.visualization.LineChartOptions {
  let options: google.visualization.LineChartOptions = {
    animation: {
      duration: 250,
      easing: 'ease-in-out',
      startup: true
    },
    legend: { position: 'none' },
    height: 700,
    width: 1000,
    hAxis: {
      gridlines: {
        color: 'white'
      }
    },
    vAxis: {
      minorGridlines: {
        color: 'white'
      }
    },
    series: {}
  }

  if (!colors) {
    colors = defaultColors;
  }
  graphData.forEach((data, index) => {
    options.series[index] = { color: colors[index % colors.length] };
  })
  return options;
}

/** Creates the required properties for an IAM graph */
export function createIamGraphProperties(graphData: ProjectGraphData[], colors?: string[]): { rows: any[], columns: any[], options: google.visualization.LineChartOptions } {
  let rows = createIamRows(graphData, colors);
  let columns = createIamColumns(graphData);
  let options = createIamOptions(graphData, colors);
  return { rows: rows, columns: columns, options: options };
}

/** Gets the fake response for the given request */
function getFake(url: string, method: string): Blob {
  return fakeResponses[url];
}

/** Sets the faked-out test response for the given url. Response should be a JS object that can be stringified */
export function setResponse(url: string, response: any) {
  fakeResponses[url] = response;
}

/** Generate fake data for project 1 */
function fakeProject1(): void {
  let projectId = 'project-1';
  // Fake data for showing the graph
  let iamBindings: { [key: number]: number } = {
    [Date.parse('1 Jun 2020 UTC')]: 131,
    [Date.parse('2 Jun 2020 UTC')]: 56,
    [Date.parse('3 Jun 2020 UTC')]: 84,
    [Date.parse('4 Jun 2020 UTC')]: 101,
    [Date.parse('5 Jun 2020 UTC')]: 100,
    [Date.parse('6 Jun 2020 UTC')]: 90,
    [Date.parse('7 Jun 2020 UTC')]: 66,
    [Date.parse('8 Jun 2020 UTC')]: 136,
    [Date.parse('9 Jun 2020 UTC')]: 108,
    [Date.parse('10 Jun 2020 UTC')]: 50,
    [Date.parse('11 Jun 2020 UTC')]: 92,
    [Date.parse('12 Jun 2020 UTC')]: 136,
    [Date.parse('13 Jun 2020 UTC')]: 55,
    [Date.parse('14 Jun 2020 UTC')]: 148,
    [Date.parse('15 Jun 2020 UTC')]: 141,
    [Date.parse('16 Jun 2020 UTC')]: 64,
    [Date.parse('17 Jun 2020 UTC')]: 102,
    [Date.parse('18 Jun 2020 UTC')]: 139,
    [Date.parse('19 Jun 2020 UTC')]: 87,
    [Date.parse('20 Jun 2020 UTC')]: 57,
  };
  let recommendations: { [key: number]: Recommendation } = {
    [Date.parse('5 Jun 2020 UTC')]: new Recommendation(projectId, 'Rec 1', RecommenderType.IAM_BINDING),
    [Date.parse('9 Jun 2020 UTC')]: new Recommendation(projectId, 'Rec 2', RecommenderType.IAM_BINDING),
    [Date.parse('17 Jun 2020 UTC')]: new Recommendation(projectId, 'Rec 3', RecommenderType.IAM_BINDING),
    // Simulate two recommendations on one day
    [Date.parse('17 Jun 2020 UTC') + 1]: new Recommendation(projectId, 'Rec 4', RecommenderType.IAM_BINDING),
  }

  let url = `/get-project-data?id="${projectId}"`;
  // Fake out the given url to the generated fake project
  setResponse(url, new ProjectGraphData(projectId, iamBindings, recommendations));
}

/** Generate fake data for project 2 */
function fakeProject2(): void {
  let projectId = 'project-2';
  // Fake data for showing the graph
  let iamBindings: { [key: number]: number } = {
    [Date.parse('1 Jun 2020 UTC')]: 28,
    [Date.parse('2 Jun 2020 UTC')]: 36,
    [Date.parse('3 Jun 2020 UTC')]: 22,
    [Date.parse('4 Jun 2020 UTC')]: 62,
    [Date.parse('5 Jun 2020 UTC')]: 60,
    [Date.parse('6 Jun 2020 UTC')]: 41,
    [Date.parse('7 Jun 2020 UTC')]: 52,
    [Date.parse('8 Jun 2020 UTC')]: 27,
    [Date.parse('9 Jun 2020 UTC')]: 55,
    [Date.parse('10 Jun 2020 UTC')]: 38,
    [Date.parse('11 Jun 2020 UTC')]: 28,
    [Date.parse('12 Jun 2020 UTC')]: 38,
    [Date.parse('13 Jun 2020 UTC')]: 34,
    [Date.parse('14 Jun 2020 UTC')]: 18,
    [Date.parse('15 Jun 2020 UTC')]: 12,
    [Date.parse('16 Jun 2020 UTC')]: 48,
    [Date.parse('17 Jun 2020 UTC')]: 47,
    [Date.parse('18 Jun 2020 UTC')]: 60,
    [Date.parse('19 Jun 2020 UTC')]: 20,
    [Date.parse('20 Jun 2020 UTC')]: 61,
  };
  let recommendations: { [key: number]: Recommendation } = {
    [Date.parse('1 Jun 2020 UTC')]: new Recommendation(projectId, 'Rec 1', RecommenderType.IAM_BINDING),
    [Date.parse('9 Jun 2020 UTC')]: new Recommendation(projectId, 'Rec 2', RecommenderType.IAM_BINDING),
    [Date.parse('20 Jun 2020 UTC')]: new Recommendation(projectId, 'Rec 3', RecommenderType.IAM_BINDING),
    // Simulate two recommendations on one day
    [Date.parse('20 Jun 2020 UTC') + 1]: new Recommendation(projectId, 'Rec 4', RecommenderType.IAM_BINDING),
  }

  let url = `/get-project-data?id="${projectId}"`;
  // Fake out the given url to the generated fake project
  setResponse(url, new ProjectGraphData(projectId, iamBindings, recommendations));
}

/** Generate fake data for projects 1 and 2 and sets the appropriate response from request() */
export function fakeProjects(): void {
  let prj1 = new Project('Project 1', 'project-1', 1, new ProjectMetaData(100));
  let prj2 = new Project('Project 2', 'project-2', 2, new ProjectMetaData(70));
  setResponse('/list-project-summaries', [prj1, prj2]);
  fakeProject1();
  fakeProject2();
}
