import _ from 'lodash';

export class GroupByTagsCtrl {
  tags: string[];
  selectedTags: { [key: string]: boolean } = {};
  inputVisible: boolean;
  allowedValues: string[];

  constructor() {
    this.tags.forEach((tag) => (this.selectedTags[tag] = true));
  }

  onChange(): void {
    this.tags = _.keys(_.pickBy(this.selectedTags));
  }

  addCustom(tag: string): void {
    if (!_.isEmpty(tag)) {
      this.selectedTags[tag] = true;
    }
    this.inputVisible = !this.inputVisible;
  }
}

export function GroupByTagsDirective() {
  return {
    bindToController: true,
    controller: GroupByTagsCtrl,
    controllerAs: 'ctrl',
    restrict: 'E',
    scope: {
      allowedValues: '=',
      tags: '=',
    },
    templateUrl: 'public/plugins/grafana-kairosdb-datasource/partials/group.by.tags.html',
  };
}
