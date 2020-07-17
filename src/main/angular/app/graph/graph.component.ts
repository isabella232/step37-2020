// Copyright 2019 Google LLC
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

import {
  Component,
  OnInit,
  Input,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import {Project} from '../../model/project';
import {GraphProcessorService} from '../services/graph_processor.service';
import {GraphProperties, Columns} from '../../model/types';
import {DataService} from '../services/data.service';
import {WIDTH_SCALE_FACTOR, HEIGHT_SCALE_FACTOR} from '../../constants';
import {DateRange} from '../../model/date_range';

/** The angular component that contains the graph and associated logic. */
@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.css'],
})
export class GraphComponent implements OnInit {
  /** The projects to display on the graph. */
  @Input()
  public projects: Project[];

  public properties: GraphProperties = this.graphProcessor.initProperties();

  /** Whether to show the chart. When it's not selected, prompt the user to select a project. */
  public shouldShowChart: boolean;

  /** Whether there's an active web request. */
  public hasActiveRequest: boolean;

  constructor(
    private dataService: DataService,
    private graphProcessor: GraphProcessorService
  ) {
    this.shouldShowChart = false;
    this.projects = [];
    this.hasActiveRequest = false;
  }

  /** Called when an input field changes. */
  ngOnChanges(changes: SimpleChanges) {
    this.shouldShowChart = this.projects.length > 0;
    this.hasActiveRequest = true;
    this.graphProcessor
      .processChanges(changes, this.properties, this.dataService)
      .then(() => {
        this.hasActiveRequest = false;
      });
  }

  ngOnInit() {
    this.properties.width = window.innerWidth * WIDTH_SCALE_FACTOR;
    this.properties.height = window.innerHeight * HEIGHT_SCALE_FACTOR;
  }

  /** Change the range on the graph */
  changeDateRange(dateRange: DateRange) {
    this.properties.options.hAxis.viewWindow.min = dateRange.getStart();
    this.properties.options.hAxis.viewWindow.max = dateRange.getEnd();
    // Force a refresh of the chart
    const temp: Columns = [];
    this.properties.columns = temp.concat(this.properties.columns);
  }

  /** Listen for resizes of the window */
  @HostListener('window:resize')
  onResize() {
    this.properties.width = window.innerWidth * WIDTH_SCALE_FACTOR;
    this.properties.height = window.innerHeight * HEIGHT_SCALE_FACTOR;
  }
}
