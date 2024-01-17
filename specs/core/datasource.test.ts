import {expect, jest} from "@jest/globals";
import {KairosDBDatasource} from "../../src/core/datasource";
import {buildNoopTemplatingSrvMock} from "../mocks";

describe("KairosDBDatasource", () => {
    const instanceSettings = {type: "type", url: "url", name: "name", jsonData: {}};
    const promiseUtils = jest.fn();

    it("should handle metric tags response correctly", () => {
        // given
        const metricName = "metricName";
        const expectedTags = ["tag", "another tag", "metricTag"];
        const response = {
            data: {
                queries: [{
                    results: [
                        {
                            tags: expectedTags
                        }
                    ]
                }]
            }
        };
        const backendSrv = {
            datasourceRequest: () => {
                return {
                    then: (responseHandler) => responseHandler(response)
                };
            }
        };
        const datasource: KairosDBDatasource =
            new KairosDBDatasource(instanceSettings, promiseUtils, backendSrv, buildNoopTemplatingSrvMock());
        // when
        const metricTags = datasource.getMetricTags(metricName);
        // then
        expect(metricTags).toBe(expectedTags);
    });
});
