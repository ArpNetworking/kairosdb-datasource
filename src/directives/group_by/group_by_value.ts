import _ from 'lodash';

export class GroupByValueCtrl {
  entries: string[];
  inputVisible: boolean;

  add(value) {
    if (value && _.isNumber(parseInt(value, 10))) {
      this.entries.push(value);
    }
    this.inputVisible = !this.inputVisible;
  }

  remove(entry) {
    this.entries = _.without(this.entries, entry);
  }
}

export function GroupByValueDirective() {
  return {
    bindToController: true,
    controller: GroupByValueCtrl,
    controllerAs: 'ctrl',
    restrict: 'E',
    scope: {
      entries: '=',
    },
    templateUrl: 'public/plugins/grafana-kairosdb-datasource/partials/group.by.value.html',
  };
}
