import _ from 'lodash';
import { getLocaleData, dateTime, isDateTime } from '@grafana/data';

import { KairosDBTarget } from '../beans/request/target';
import * as rangeUtil from '../utils/rangeutil';

export class TimePickerCtrl {
  static tooltipFormat = 'MMM D, YYYY HH:mm:ss';
  static defaults = {
    time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
    refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
  };

  dashboard: any;
  query: KairosDBTarget;
  panel: any;
  absolute: any;
  timeRaw: any;
  editTimeRaw: any;
  tooltip: string;
  rangeString: string;
  timeOptions: any;
  refresh: any;
  isUtc: boolean;
  firstDayOfWeek: number;
  isOpen: boolean;
  isAbsolute: boolean;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private timeSrv) {
    this.$scope.ctrl = this;

    $scope.$parent.$watch('timeOverridden', (newValue, oldValue) => {
      if (newValue !== undefined) {
        if (newValue) {
          this.enableOverride();
        } else {
          this.disableOverride();
        }
      }
    });

    $rootScope.onAppEvent('closeTimepicker', this.openDropdown.bind(this), $scope);

    this.dashboard.on('refresh', this.onRefresh.bind(this), $scope);

    // init options
    this.panel = this.dashboard.timepicker;
    _.defaults(this.panel, TimePickerCtrl.defaults);
    this.firstDayOfWeek = getLocaleData().firstDayOfWeek();

    // init time stuff
    this.onRefresh();
  }

  onRefresh() {
    let timeRaw = this.query.timeRange;

    if (!timeRaw) {
      timeRaw = this.timeSrv.timeRange().raw;
    }

    if (this.dashboard.getTimezone() !== 'utc') {
      if (isDateTime(timeRaw?.from)) {
        timeRaw?.from.local();
      }
      if (isDateTime(timeRaw?.to)) {
        timeRaw?.to.local();
      }
      this.isUtc = false;
    } else {
      this.isUtc = true;
    }

    const fromMoment = dateTime(timeRaw?.from);
    const toMoment = dateTime(timeRaw?.to);

    if (timeRaw === undefined) {
      this.rangeString = '?';
    } else {
      this.rangeString = rangeUtil.describeTimeRange(timeRaw);
    }
    this.absolute = { fromJs: fromMoment.toDate(), toJs: toMoment.toDate() };
    this.tooltip = this.dashboard.formatDate(fromMoment) + ' <br>to<br>';
    this.tooltip += this.dashboard.formatDate(toMoment);
    this.timeRaw = timeRaw;
    this.isAbsolute = isDateTime(this.timeRaw.to);
  }

  openDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
      return;
    }

    this.onRefresh();
    this.editTimeRaw = this.timeRaw;
    this.timeOptions = rangeUtil.getRelativeTimesList(this.panel, this.rangeString);
    this.refresh = {
      value: this.dashboard.refresh,
      options: _.map(this.panel.refresh_intervals, (interval: any) => {
        return { text: interval, value: interval };
      }),
    };

    this.refresh.options.unshift({ text: 'off' });
    this.isOpen = true;
    this.$rootScope.appEvent('timepickerOpen');
  }

  closeDropdown() {
    this.isOpen = false;
    this.onRefresh();
    this.$rootScope.appEvent('timepickerClosed');
  }

  applyCustom() {
    this.query.timeRange = { from: this.editTimeRaw.from, to: this.editTimeRaw.to };
    this.closeDropdown();
  }

  absoluteFromChanged() {
    this.editTimeRaw.from = this.getAbsoluteMomentForTimezone(this.absolute.fromJs);
  }

  absoluteToChanged() {
    this.editTimeRaw.to = this.getAbsoluteMomentForTimezone(this.absolute.toJs);
  }

  getAbsoluteMomentForTimezone(jsDate) {
    return this.dashboard.getTimezone() === 'utc' ? dateTime(jsDate).utc() : dateTime(jsDate);
  }

  setRelativeFilter(timespan) {
    const range = { from: timespan.from, to: timespan.to };

    if (this.panel.nowDelay && range.to === 'now') {
      range.to = 'now-' + this.panel.nowDelay;
    }

    this.query.timeRange = range;
    this.closeDropdown();
  }

  enableOverride() {
    const timeRaw = this.timeSrv.timeRange().raw;
    this.query.timeRange = { from: timeRaw.from, to: timeRaw.to };
    this.onRefresh();
  }

  disableOverride() {
    this.query.timeRange = undefined;
    this.onRefresh();
  }
}

export function TimePickerDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/plugins/grafana-kairosdb-datasource/partials/timepicker.html',
    controller: TimePickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
      query: '=',
    },
  };
}
