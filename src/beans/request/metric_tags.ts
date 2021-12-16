import _ from 'lodash';

export class MetricTags {
  tags: { [key: string]: string[] } = {};
  size = 0;
  initialized = false;
  combinations = 0;
  multiValuedTags: string[] = [];

  updateTags(tags) {
    this.tags = tags;
    this.updateInfo();
    this.initialized = true;
  }

  private updateInfo() {
    const notEmptyTags = _.pickBy(this.tags, (value) => value.length);
    this.combinations =
      _.reduce(
        _.map(notEmptyTags, (values) => values.length),
        (length1, length2) => length1 * length2
      ) || 0;
    this.multiValuedTags = _.keys(_.pickBy(notEmptyTags, (tagValues) => tagValues.length > 1));
    this.size = _.keys(this.tags).length;
  }
}
