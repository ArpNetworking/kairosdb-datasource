import {expect} from "@jest/globals";
import {TemplatingUtils} from "../../src/utils/templating_utils";
import {buildTemplatingSrvMock} from "../mocks";

describe("TemplatingUtils", () => {
    it("should unpack single variable with single value", () => {
        // given
        const variables = {
            variable: ["value"]
        };
        const templatingSrvMock = buildTemplatingSrvMock(variables);
        const templatingUtils = new TemplatingUtils(templatingSrvMock, {});
        const expression = "$variable";
        // when
        const values = templatingUtils.replace(expression);
        // then
        expect(values.length).toBe(1);
        expect(values[0]).toBe("value");
    });

    it("should unpack single variable with multiple values", () => {
        // given
        const variables = {
            variable: ["value1", "value2", "value3"]
        };
        const templatingSrvMock = buildTemplatingSrvMock(variables);
        const templatingUtils = new TemplatingUtils(templatingSrvMock, {});
        const expression = "$variable";
        // when
        const values = templatingUtils.replace(expression);
        // then
        expect(values.length).toBe(3);
        expect(values[0]).toBe("value1");
        expect(values[1]).toBe("value2");
        expect(values[2]).toBe("value3");
    });

    it("should unpack single variable with prefix and suffix and multiple values", () => {
        // given
        const variables = {
            variable: ["value1", "value2", "value3"]
        };
        const templatingSrvMock = buildTemplatingSrvMock(variables);
        const templatingUtils = new TemplatingUtils(templatingSrvMock, {});
        const expression = "prefix_$variable_suffix";
        // when
        const values = templatingUtils.replace(expression);
        // then
        expect(values.length).toBe(3);
        expect(values[0]).toBe("prefix_value1_suffix");
        expect(values[1]).toBe("prefix_value2_suffix");
        expect(values[2]).toBe("prefix_value3_suffix");
    });

    it("should replace many multivalue variables with cartesian", () => {
        // given
        const variables = {
            dc: ["dc1", "dc2", "dc3"],
            ip: ["127.0.0.1", "192.168.0.1"]
        };
        const templatingSrvMock = buildTemplatingSrvMock(variables);
        const templatingUtils = new TemplatingUtils(templatingSrvMock, {});
        const expression = "datacenter_[[dc]]_ip_[[ip]]_sth";
        // when
        const values = templatingUtils.replace(expression);
        // then
        expect(values).toEqual(expect.arrayContaining(["datacenter_dc1_ip_127.0.0.1_sth"]));
        expect(values).toEqual(expect.arrayContaining(["datacenter_dc2_ip_127.0.0.1_sth"]));
        expect(values).toEqual(expect.arrayContaining(["datacenter_dc3_ip_127.0.0.1_sth"]));
        expect(values).toEqual(expect.arrayContaining(["datacenter_dc1_ip_192.168.0.1_sth"]));
        expect(values).toEqual(expect.arrayContaining(["datacenter_dc2_ip_192.168.0.1_sth"]));
        expect(values).toEqual(expect.arrayContaining(["datacenter_dc3_ip_192.168.0.1_sth"]));
        expect(values.length).toBe(6);
    });

    it("should replace all expressions", () => {
        // given
        const variables = {
            dc: ["dc1", "dc2", "dc3"]
        };
        const templatingSrvMock = buildTemplatingSrvMock(variables);
        const templatingUtils = new TemplatingUtils(templatingSrvMock, {});
        const expressions = ["$dc", "sth_$dc", "$dc_sth"];
        // when
        const values = templatingUtils.replaceAll(expressions);
        // then
        expect(values).toEqual(expect.arrayContaining(["dc1"]));
        expect(values).toEqual(expect.arrayContaining(["dc2"]));
        expect(values).toEqual(expect.arrayContaining(["dc3"]));
        expect(values).toEqual(expect.arrayContaining(["sth_dc1"]));
        expect(values).toEqual(expect.arrayContaining(["sth_dc2"]));
        expect(values).toEqual(expect.arrayContaining(["sth_dc3"]));
        expect(values).toEqual(expect.arrayContaining(["dc1_sth"]));
        expect(values).toEqual(expect.arrayContaining(["dc2_sth"]));
        expect(values).toEqual(expect.arrayContaining(["dc3_sth"]));
    });

    it("should handle variable-values containing ','", () => {
        // given
        const variables = {
            var_with_comma: ["v0,1", "v0,2"]
        };
        const templatingSrvMock = buildTemplatingSrvMock(variables);
        const templatingUtils = new TemplatingUtils(templatingSrvMock, {});
        const expressions = ["$var_with_comma"];
        // when
        const values = templatingUtils.replaceAll(expressions);
        // then
        expect(values).toEqual(expect.arrayContaining(["v0,1"]));
        expect(values).toEqual(expect.arrayContaining(["v0,2"]));
        expect(values).toEqual(expect.not.arrayContaining(["v0"]));
        expect(values).toEqual(expect.not.arrayContaining(["1"]));
    });

    it("should handle variable-values containing '{' and '}'", () => {
        // given
        const variables = {
            var_with_curly: ["/path/{id}/new", "/path/{id}/edit"]
        };
        const templatingSrvMock = buildTemplatingSrvMock(variables);
        const templatingUtils = new TemplatingUtils(templatingSrvMock, {});
        const expressions = ["$var_with_curly"];
        // when
        const values = templatingUtils.replaceAll(expressions);
        // then
        expect(values).toEqual(expect.arrayContaining(["/path/{id}/new"]));
        expect(values).toEqual(expect.arrayContaining(["/path/{id}/edit"]));
    });

    describe("Custom formatter fn", () => {
        it("Does no special-casing for single values", () => {
            const input = "hello";
            const expected = "hello";
            const actual = TemplatingUtils.customFormatterFn(input);
            expect(expected).toBe(actual);
        });

        it("Uses the new MULTI_VALUE_SEPARATOR for multi-value", () => {
            const input = ["thing,1", "thing,2"];
            const expected = "{thing,1_MAGIC_DELIM_thing,2}";
            const actual = TemplatingUtils.customFormatterFn(input);
            expect(expected).toBe(actual);
        });

        it("Handles array with length 1 gracefully", () => {
            const input = ["thing,1"];
            const expected = "thing,1";
            const actual = TemplatingUtils.customFormatterFn(input);
            expect(expected).toBe(actual);
        });
    });
});
