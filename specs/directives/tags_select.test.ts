import {expect} from "@jest/globals";
import {SegmentLike, TagsSelectCtrl} from "../../src/directives/tags_select";

const valAsSegment = (val: string): SegmentLike => {
    return {
        value: val,
        type: "plus-button",
    };
};

const newPlusButtonSegment = (): SegmentLike => {
    return {
        value: undefined, // or nil?
        type: "plus-button",
    };
};

const buildUiSegmentSrvMock = () => {
    return {
        newSegment: valAsSegment,
        newPlusButton: newPlusButtonSegment,
    };
};

const val1 = "val1";
const val2 = "val2";

describe.skip("TagsSelectCtrl", () => {
    const uiSegmentSrv = buildUiSegmentSrvMock();

    // Nasty hack to avoid dealing with nginject stuff
    beforeEach( () => {
        TagsSelectCtrl.prototype.selectedValues = [
            val1,
            null, // just some scary values we expect to be cleaned up
            undefined
        ];
    });

    it("render, even when the selected values contain nil values", () => {
        const tagsSelectCtrl: TagsSelectCtrl = new TagsSelectCtrl(uiSegmentSrv);
        expect(tagsSelectCtrl.selectedValues).toEqual([val1]);
        expect(tagsSelectCtrl.segments).toEqual([
            valAsSegment(val1), // the set value
            newPlusButtonSegment(), // the plus-button after it
        ]);
    });

    it("Remove works", () => {
        const tagsSelectCtrl: TagsSelectCtrl = new TagsSelectCtrl(uiSegmentSrv);
        expect(tagsSelectCtrl.segments).toEqual([
            valAsSegment(val1),
            newPlusButtonSegment(), // the plus-button after it
        ]);

        // remove the first one and see what happens
        tagsSelectCtrl.remove(tagsSelectCtrl.segments[0]);
        expect(tagsSelectCtrl.selectedValues).toEqual([]);
        expect(tagsSelectCtrl.segments).toEqual([
            newPlusButtonSegment(),
        ]);
    });

    it("Update changes selected values", () => {
        const tagsSelectCtrl: TagsSelectCtrl = new TagsSelectCtrl(uiSegmentSrv);
        expect(tagsSelectCtrl.segments).toEqual([
            valAsSegment(val1),
            newPlusButtonSegment(), // the plus-button after it
        ]);

        // Simulate the value being changed in the view
        tagsSelectCtrl.segments[0].value = val2;

        tagsSelectCtrl.onChange();
        expect(tagsSelectCtrl.selectedValues).toEqual([val2]);
        expect(tagsSelectCtrl.segments).toEqual([
            valAsSegment(val2),
            newPlusButtonSegment(),
        ]);
    });

    it("deals with undefined SelectedValues", () => {
        // nasty hack to avoid DI
        TagsSelectCtrl.prototype.selectedValues = undefined;
        const tagsSelectCtrl: TagsSelectCtrl = new TagsSelectCtrl(uiSegmentSrv);
        expect(tagsSelectCtrl.selectedValues).toEqual([]);
        expect(tagsSelectCtrl.segments).toEqual([
            newPlusButtonSegment(),
        ]);
    });

});
