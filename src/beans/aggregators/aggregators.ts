import {Aggregator} from "./aggregator";
import {ApdexAggregator} from "./apdex_aggregator";
import {DivideAggregator} from "./divide_aggregator";
import {FilterAggregator} from "./filter_aggregator";
import {MergeAggregator} from "./merge_aggregator";
import {PercentileAggregator} from "./percentile_aggregator";
import {RangeAggregator} from "./range_aggregator";
import {RateAggregator} from "./rate_aggregator";
import {SamplerAggregator} from "./sampler_aggregator";
import {ScaleAggregator} from "./scale_aggregator";
import {SmaAggregator} from "./sma_aggregator";
import {TrimAggregator} from "./trim_aggregator";

export const AGGREGATORS = [
    new RangeAggregator("avg"),
    new RangeAggregator("dev"),
    new RangeAggregator("count"),
    new RangeAggregator("first"),
    new RangeAggregator("gaps"),
    new RangeAggregator("last"),
    new RangeAggregator("least_squares"),
    new RangeAggregator("max"),
    new RangeAggregator("min"),
    new MergeAggregator(),
    new RangeAggregator("movingWindow"),
    new PercentileAggregator(),
    new ApdexAggregator(),
    new SmaAggregator(),
    new RangeAggregator("sum"),
    new Aggregator("diff"),
    new DivideAggregator(),
    new RateAggregator(),
    new SamplerAggregator(),
    new ScaleAggregator(),
    new TrimAggregator(),
    new FilterAggregator(),
    new Aggregator("percent_remaining")
].sort( (a, b) => a.name.localeCompare(b.name));

const RANGE_AGGREGATORS = ["avg", "dev", "count", "first", "gaps",
    "last", "least_squares", "max", "min", "gaps", "sum", "movingWindow"];

/* Loosely generated from running `grep -rl "oubleDataPointFactory"`
 pointed at the directories for kairosdb core and kairosdb-extensions
 kairosdb-extensions/src/main/java/io/inscopemetrics/kairosdb/aggregators
 and
 kairosdb/src/main/java/org/kairosdb/core/aggregator
 respectively.
 Many of the java class names are synonyms and not exact matches of the names here.
 */
export const SCALAR_AGGREGATOR_NAMES = [
    "apdex",
    "avg",
    "count",
    "dev",
    "diff",
    "div",
    "first",
    "last",
    "least_squares",
    "max",
    "min",
    "merge",
    "percent_remaining",
    "percentile",
    "rate",
    "sampler",
    "scale",
    "sma",
    "sum",
];

export function fromObject(object: Aggregator): Aggregator {
  if (RANGE_AGGREGATORS.indexOf(object.name) >= 0) {
      return RangeAggregator.fromObject(object);
  } else if (object.name === PercentileAggregator.NAME) {
      return PercentileAggregator.fromObject(object);
  } else if (object.name === MergeAggregator.NAME) {
      return MergeAggregator.fromObject(object);
  } else if (object.name === ApdexAggregator.NAME) {
      return ApdexAggregator.fromObject(object);
  } else if (object.name === SmaAggregator.NAME) {
      return SmaAggregator.fromObject(object);
  } else if (object.name === DivideAggregator.NAME) {
      return DivideAggregator.fromObject(object);
  } else if (object.name === RateAggregator.NAME) {
      return RateAggregator.fromObject(object);
  } else if (object.name === SamplerAggregator.NAME) {
      return SamplerAggregator.fromObject(object);
  } else if (object.name === ScaleAggregator.NAME) {
      return ScaleAggregator.fromObject(object);
  } else if (object.name === TrimAggregator.NAME) {
      return TrimAggregator.fromObject(object);
  } else if (object.name === "diff") {
      return new Aggregator("diff");
  } else if (object.name === FilterAggregator.NAME) {
      return FilterAggregator.fromObject(object);
  } else if (object.name === "percent_remaining") {
      return new Aggregator("percent_remaining");
  }

  return object;
}
