module powerbi.extensibility.visual {
    function getMeasureIndex(dv: DataViewCategorical, measureName: string): number {
        let RetValue: number = -1;
        for (let i = 0; i < dv.values.length; i++) {
            if (dv.values[i].source.roles[measureName] === true) {
                RetValue = i;
                break;
            }
        }
        return RetValue;
    }
}