import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;

module powerbi.extensibility.visual {


    window["requestAnimFrame"] = (function () {
        return window.requestAnimationFrame ||
            window["webkitRequestAnimationFrame"] ||
            window["mozRequestAnimationFrame"] ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    window["cancelAnimFrame"] = (function () {//cancelAnimationFrame Polyfill
        return window.cancelAnimationFrame ||
            window["webkitCancelAnimationFrame"] ||
            window["mozCancelAnimationFrame"] ||
            function (id) {
                window.clearTimeout(id);
            };
    })();


    interface VisualViewModel {
        dataPoints: VisualDataPoint[];
        settings: VisualSettings;
    };

    interface VisualDataPoint {
        categoryText: string;
        measureAbsolute: number;
        measureDeviation: number;
        measureAbsoluteFormatted: string;
        measureDeviationFormatted: string;
    };

    interface VisualSettings {
        scroller: {
            pShouldAutoSizeFont: boolean;
            pShouldIndicatePosNeg: boolean;
            pShouldUsePosNegColoring: boolean;
            pShouldUseTextColoring: boolean;
            pFontSize: number;
            pSpeed: number;
            pCustomText: string;
            pForeColor: Fill;
            pBgColor: Fill;
            pInterval: number;
        };
    }

    export interface TextCategory {
        txtCategory: string;
        txtDataAbsoluteFormatted: string;
        txtDataRelativeFormatted: string;
        txtSplitChar: string;
        txtSeparator: string;
        colText: string;
        colStatus: string;
        posX: number;
        svgSel: d3.Selection<SVGElement>;
        sCategory: d3.Selection<SVGElement>;
        sDataAbsoluteFormatted: d3.Selection<SVGElement>;
        sDataRelativeFormatted: d3.Selection<SVGElement>;
        sSplitChar: d3.Selection<SVGElement>;
        sSeparator: d3.Selection<SVGElement>;
        actualWidth: number;
    }


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

    function visualTransform(options: VisualUpdateOptions, host: IVisualHost, thisRef: Visual): VisualViewModel {
        let dataViews = options.dataViews;
        let defaultSettings: VisualSettings = {
            scroller: {
                pShouldAutoSizeFont: false,
                pShouldIndicatePosNeg: true,
                pShouldUsePosNegColoring: true,
                pShouldUseTextColoring: false,
                pFontSize: 20,
                pSpeed: 1.2,
                pCustomText: "",
                pForeColor: { solid: { color: "#ffffff" } },
                pBgColor: { solid: { color: "#000000" } },
                pInterval: 50
            }
        }; 
        let viewModel: VisualViewModel = {
            dataPoints: [],
            settings: <VisualSettings>{}
        };

        /*
        if (!dataViews
            || !dataViews[0]
            || !dataViews[0].categorical
            || !dataViews[0].categorical.categories
            || !dataViews[0].categorical.categories[0].source
            || !dataViews[0].categorical.values)
            return viewModel;
            */

        if ( !dataViews[0] ) {
            return viewModel;
        }


        let objects = dataViews[0].metadata.objects;
        let visualSettings: VisualSettings = {
            scroller: {
                pShouldAutoSizeFont: getValue<boolean>(objects, 'scroller', 'pShouldAutoSizeFont', defaultSettings.scroller.pShouldAutoSizeFont),
                pShouldIndicatePosNeg: getValue<boolean>(objects, 'scroller', 'pShouldIndicatePosNeg', defaultSettings.scroller.pShouldIndicatePosNeg),
                pShouldUsePosNegColoring: getValue<boolean>(objects, 'scroller', 'pShouldUsePosNegColoring', defaultSettings.scroller.pShouldUsePosNegColoring),
                pShouldUseTextColoring: getValue<boolean>(objects, 'scroller', 'pShouldUseTextColoring', defaultSettings.scroller.pShouldUseTextColoring),
                pFontSize: getValue<number>(objects, 'scroller', 'pFontSize', defaultSettings.scroller.pFontSize),
                pSpeed: getValue<number>(objects, 'scroller', 'pSpeed', defaultSettings.scroller.pSpeed),
                pCustomText: getValue<string>(objects, 'scroller', 'pCustomText', defaultSettings.scroller.pCustomText),
                pForeColor: getValue<Fill>(objects, 'scroller', 'pForeColor', defaultSettings.scroller.pForeColor),
                pBgColor: getValue<Fill>(objects, 'scroller', 'pBgColor', defaultSettings.scroller.pBgColor),
                pInterval: getValue<number>(objects, 'scroller', 'pInterval', defaultSettings.scroller.pInterval)
            }
        }
        viewModel.settings = visualSettings;

        if (! dataViews[0] 
            ||!dataViews[0].categorical 
            ||!dataViews[0].categorical.values ) {
            return viewModel;
        }        

        // Set property limits

        if ( visualSettings.scroller.pFontSize > 1000  ) {
            visualSettings.scroller.pFontSize = 1000;
        } else if ( visualSettings.scroller.pFontSize < 0  ) {
            visualSettings.scroller.pFontSize = 0;
        }

        if ( visualSettings.scroller.pSpeed > 1000  ) {
            visualSettings.scroller.pSpeed = 1000;
        } else if ( visualSettings.scroller.pSpeed < 0  ) {
            visualSettings.scroller.pSpeed = 0;
        }

        let categorical = dataViews[0].categorical;
        let category = typeof(categorical.categories)==='undefined' ? null : categorical.categories[0];
        let dataValue = categorical.values[0];

        let measureAbsoluteIndex = getMeasureIndex(categorical, "Measure Absolute");
        let measureDeviationIndex = getMeasureIndex(categorical, "Measure Deviation");

        // If we dont have a category, set a default one
        if ( category === null ) {
            let tmp:DataViewCategoryColumn = {
                source:null,
                values:[]
            };
            category = tmp;
            category.values = [];
            category.values.push("");
        }


        let visualDataPoints: VisualDataPoint[] = [];
        for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
            var measureAbs = measureAbsoluteIndex > -1 ? <number>categorical.values[measureAbsoluteIndex].values[i] : null;
            var measureDev = measureDeviationIndex > -1 ? <number>categorical.values[measureDeviationIndex].values[i] : null;
            var measureAbsForm = measureAbsoluteIndex > -1 ? valueFormatter.format(<number>categorical.values[measureAbsoluteIndex].values[i], dataViews[0].categorical.values.grouped()[0].values[measureAbsoluteIndex].source.format) : null;
            var measureDevForm = measureDeviationIndex > -1 ? valueFormatter.format(<number>categorical.values[measureDeviationIndex].values[i], dataViews[0].categorical.values.grouped()[0].values[measureDeviationIndex].source.format) : null;
            visualDataPoints.push({
                categoryText: <string>category.values[i],
                measureAbsolute: measureAbs,
                measureDeviation:  measureDev,
                measureAbsoluteFormatted: measureAbsForm,
                measureDeviationFormatted:  measureDevForm
            });
        }      

        return {
            dataPoints: visualDataPoints,
            settings: visualSettings
        };

        
    }

    export class Visual implements IVisual {
        private host: IVisualHost;
        private updateCount: number;

        private svg: d3.Selection<SVGElement>;
        private gWidth : number;
        private gHeight: number;

        private visualCurrentSettings: VisualSettings;
        private visualDataPoints: VisualDataPoint[];
        private selectionManager: ISelectionManager;

        private shouldRestartAnimFrame: boolean = false;
        private animationFrameLoopStarted: boolean = false;
        private animationLastTime: any = null;

      
      
      
        //private colorPalette: IDataColorPalette;

        private dataView: DataView;
        private rect: d3.Selection<SVGElement>;
        private sText: d3.Selection<SVGElement>;

        private activeSpeed: number = 0;
        private activeFontSize: number = 0;
        private activeTargetSpeed: number = 0;
        private totalTextWidth: number = 1000;
        private viewportWidth: number = 1000;
        private viewportHeight: number = 1000;
        private measure0Index = 0;
        private measure1Index = 1;
        private gPosX: number = 0;

        private arrTextCategories: TextCategory[];

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();
            this.svg = d3.select(options.element).append("svg");
            options.element.style.overflowX = "hidden";

            var that = this;
            this.rect = this.svg.append("rect")
            .on("mouseover", function () {
                that.activeTargetSpeed = 0;
            })
            .on("mouseout", function () {
                that.activeTargetSpeed = that.visualCurrentSettings.scroller.pSpeed;
            });

            this.sText = this.svg.append("text");
        }

        
        public update(options: VisualUpdateOptions) {
            this.shouldRestartAnimFrame = true;

            let viewModel: VisualViewModel = visualTransform(options, this.host, this);
            let settings = this.visualCurrentSettings = viewModel.settings;
            this.visualDataPoints = viewModel.dataPoints;
            
            let width = this.gWidth = options.viewport.width;
            let height = this.gHeight = options.viewport.height;

            if ( (this.visualDataPoints.length === 0 && typeof(this.visualCurrentSettings.scroller) === 'undefined') || (this.visualDataPoints.length === 0 && this.visualCurrentSettings.scroller.pCustomText.length === 0) ) {
                // if we have no data and no custom text we want to exit.
                this.svg.attr("visibility", "hidden");
                return;
            }

            this.svg.attr("visibility", "visible");           

            this.svg
                .attr("width", width)
                .attr("height", height);

              var dataViews = options.dataViews;
            if (!dataViews) return;
            
            this.dataView = options.dataViews[0];
            var that = this;
            this.shouldRestartAnimFrame = true;

            this.activeTargetSpeed = this.visualCurrentSettings.scroller.pSpeed;

            if (width < 0)
                width = 0;
            if (height < 0)
                height = 0;

            this.viewportWidth = width;
            this.viewportHeight = height;

            if (this.visualCurrentSettings.scroller.pShouldAutoSizeFont) {
                this.activeFontSize = height * 0.5;
            }
            else {
                this.activeFontSize = this.visualCurrentSettings.scroller.pFontSize;
            }
            if (this.activeFontSize < 0) {
                this.activeFontSize = 0;
            }
            else if (this.activeFontSize > 10000) {
                this.activeFontSize = 10000;
            }
            
             this.rect
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", height)
                .attr("fill", this.visualCurrentSettings.scroller.pBgColor.solid.color)
            ;

            this.sText.remove();
            this.sText = this.svg.append("text")
                .on("mouseover", function () {
                    that.activeTargetSpeed = 0;
                })
                .on("mouseout", function () {
                    that.activeTargetSpeed = that.visualCurrentSettings.scroller.pSpeed;
                });

            this.sText
                .attr("y", height * 0.5 + this.activeFontSize * 0.30)
                .attr("font-family", "Lucida Console")
                .attr("font-size", this.activeFontSize + "px")
                .attr("fill", "#ffffff")
            ;
      
            // Create text from data
            this.CreateTextFromData(viewModel, options.dataViews[0]);

            this.sText.each(function () {
                that.totalTextWidth = this.getBBox().width;
            });

            if (!this.animationFrameLoopStarted) {
                this.animationFrameLoopStarted = true;
                this.animationStep();
            } 
        }

        private CreateTextFromData(viewModel: VisualViewModel, dataView: DataView) {
            if (this.gPosX === 0) {
                this.gPosX = this.viewportWidth;
            }

            if (this.arrTextCategories != null && this.arrTextCategories.length > 0) {
                for (var i = 0; i < this.arrTextCategories.length; i++) {
                    if (this.arrTextCategories[i].svgSel != null) {
                        this.arrTextCategories[i].svgSel.remove();
                        this.arrTextCategories[i].svgSel = null;
                    }
                }
                this.arrTextCategories.splice(0, this.arrTextCategories.length);
            }

            this.arrTextCategories = [];

            var sText = this.visualCurrentSettings.scroller.pCustomText;
            if (sText.length > 0) {
                // We have a custom text.               
                var newCat: TextCategory = {
                    txtCategory: sText,
                    txtDataAbsoluteFormatted: "",
                    txtDataRelativeFormatted: "",
                    txtSeparator: "",
                    txtSplitChar: "",
                    colStatus: this.visualCurrentSettings.scroller.pBgColor.solid.color,
                    colText: this.visualCurrentSettings.scroller.pForeColor.solid.color,
                    posX: this.viewportWidth + 10,
                    svgSel: null,
                    sCategory: null,
                    sDataAbsoluteFormatted: null,
                    sDataRelativeFormatted: null,
                    sSeparator: null,
                    sSplitChar: null,
                    actualWidth: 0
                };
                newCat.posX = this.gPosX;
                this.arrTextCategories.push(newCat);
                return;
            }

            for (var i = 0; i < viewModel.dataPoints.length; i++) {
                var category = viewModel.dataPoints[i].categoryText;

                var bShouldRenderAbsolute = viewModel.dataPoints[i].measureAbsolute === null ? false : true;
                var bShouldRenderRelative = viewModel.dataPoints[i].measureDeviation === null ? false : true;

                var dataAbsolute, dataAbsoluteFormatted, dataRelative, dataRelativeFormatted;

                if (bShouldRenderAbsolute) {
                    dataAbsolute = viewModel.dataPoints[i].measureAbsolute;
                    dataAbsoluteFormatted = viewModel.dataPoints[i].measureAbsoluteFormatted;
                }
                if (bShouldRenderRelative) {
                    dataRelative = viewModel.dataPoints[i].measureDeviation;
                    dataRelativeFormatted = viewModel.dataPoints[i].measureDeviationFormatted;
                }
               
                // Status Color
                var colorStatus = this.visualCurrentSettings.scroller.pForeColor.solid.color;
                var colorText = this.visualCurrentSettings.scroller.pForeColor.solid.color;
                var splitChar = " ";
                if (bShouldRenderRelative && this.visualCurrentSettings.scroller.pShouldIndicatePosNeg) {
                    if (dataRelative >= 0) {
                        if (this.visualCurrentSettings.scroller.pShouldUsePosNegColoring) {
                            colorStatus = "#96C401";
                        }
                        if (this.visualCurrentSettings.scroller.pShouldUseTextColoring) {
                            colorText = "#96C401";
                        }
                        splitChar = " ▲ ";
                    }
                    else {
                        if (this.visualCurrentSettings.scroller.pShouldUsePosNegColoring) {
                            colorStatus = "#DC0002";
                        }
                        if (this.visualCurrentSettings.scroller.pShouldUseTextColoring) {
                            colorText = "#DC0002";
                        }
                        splitChar = " ▼ ";
                    }
                }

                var newCat: TextCategory = {
                    txtCategory: category,
                    txtDataAbsoluteFormatted: dataAbsoluteFormatted,
                    txtDataRelativeFormatted: dataRelativeFormatted,
                    txtSeparator: ".....",
                    txtSplitChar: splitChar,
                    colStatus: colorStatus,
                    colText: colorText,
                    posX: this.viewportWidth,
                    svgSel: null,
                    sCategory: null,
                    sDataAbsoluteFormatted: null,
                    sDataRelativeFormatted: null,
                    sSeparator: null,
                    sSplitChar: null,
                    actualWidth: 0
                };
                if (i === 0) {
                    newCat.posX = this.gPosX;
                }
                this.arrTextCategories.push(newCat);
            }
        } 

        public getMetaDataColumn(dataView: DataView) {
            var retValue = null;
            if (dataView && dataView.metadata && dataView.metadata.columns) {
                for (var i = 0, ilen = dataView.metadata.columns.length; i < ilen; i++) {
                    var column = dataView.metadata.columns[i];
                    if (column.isMeasure) {
                        retValue = column;
                        if ((<any>column.roles).Values === true) {
                            break;
                        }
                    }
                }
            }
            return retValue;
        }     

        public getMetaDataColumnForMeasureIndex(dataView: DataView, measureIndex: number) {
            var addCol = 0;
            for (var i = 0; i < dataView.metadata.columns.length; i++) {
                if (!dataView.metadata.columns[i].isMeasure)
                    addCol++;
            }
            if (dataView && dataView.metadata && dataView.metadata.columns) {
                var column = dataView.metadata.columns[measureIndex + addCol];
                if (column.isMeasure) {
                    return column;
                }
            }
            return null;
        }           
        
        // Right settings panel
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];
            
            switch (objectName) {
                case 'scroller':
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: "Scroller",
                        properties: {
                            pShouldAutoSizeFont: this.visualCurrentSettings.scroller.pShouldAutoSizeFont,
                            pShouldIndicatePosNeg: this.visualCurrentSettings.scroller.pShouldIndicatePosNeg,
                            pShouldUsePosNegColoring: this.visualCurrentSettings.scroller.pShouldUsePosNegColoring,
                            pShouldUseTextColoring: this.visualCurrentSettings.scroller.pShouldUseTextColoring,
                            pFontSize: this.visualCurrentSettings.scroller.pFontSize,
                            pSpeed: this.visualCurrentSettings.scroller.pSpeed,
                            pCustomText: this.visualCurrentSettings.scroller.pCustomText,
                            pForeColor: this.visualCurrentSettings.scroller.pForeColor,
                            pBgColor: this.visualCurrentSettings.scroller.pBgColor,
                            pInterval: this.visualCurrentSettings.scroller.pInterval
                        },
                        selector: null
                    });
                    break;
                
            };

            return objectEnumeration;
        }

        public destroy(): void {
            window["cancelAnimFrame"](this.animationId);//removes animation callback.
        }

        public animationFrameLoopExited() {
            if (this.shouldRestartAnimFrame) {
                this.shouldRestartAnimFrame = false;
                this.animationStep();
            }
        }

        private animationId: number = 0;//add a new property to keep id of animation callback.

        public animationStep() {
            if (this.shouldRestartAnimFrame) {
                this.animationFrameLoopExited();
                return;
            }
            var that = this;
            //keep id of animation callback to animationId.
            this.animationId = window["requestAnimFrame"](function () { that.animationStep(); });

            this.animationUpdateStep();
        }    

        public animationUpdateStep() {            
            var now = new Date().getTime(), dt = now - (this.animationLastTime || now);
            this.animationLastTime = now;

            var curSettings = this.visualCurrentSettings;

            var pIntervalStatic = dt * 1.2; // this.pInterval_get(this.dataView)
            for (var i = 0; i < this.arrTextCategories.length; i++) {
                var s: TextCategory = this.arrTextCategories[i];
                if (s.svgSel == null) {
                    // Create element (it's within the viewport) 
                    if (s.posX < this.viewportWidth) {
                        var bShouldRenderAbsolute = this.measure0Index >= 0 ? true : false;
                        var bShouldRenderRelative = this.measure1Index >= 0 ? true : false;

                        var y = this.viewportHeight * 0.5 + this.activeFontSize * 0.30;

                        s.svgSel = this.svg.append("text").attr("x", s.posX);
                        s.svgSel.attr("font-family", "Lucida Console").attr("font-size", this.activeFontSize + "px");

                        var that = this;
                        s.svgSel
                            .on("mouseover", function () {
                                that.activeTargetSpeed = 0;
                            })
                            .on("mouseout", function () {
                                    that.activeTargetSpeed = curSettings.scroller == null ? 0 : curSettings.scroller.pSpeed;
                            });

                        s.sCategory = s.svgSel.append("tspan")
                            .text(s.txtCategory + " ")
                            .attr("y", y)
                            .style("fill", s.colText)
                        ;

                        if (bShouldRenderAbsolute) {
                            s.sDataAbsoluteFormatted = s.svgSel.append("tspan")
                                .text(s.txtDataAbsoluteFormatted)
                                .attr("y", y)
                                .style("fill", s.colText)
                            ;

                            s.sSplitChar = s.svgSel.append("tspan")
                                .text(s.txtSplitChar)
                                .attr("y", y)
                                .style("fill", s.colStatus)
                            ;
                        }
                        if (bShouldRenderRelative) {
                            s.sSplitChar = s.svgSel.append("tspan")
                                .text(s.txtDataRelativeFormatted)
                                .attr("y", y)
                                .style("fill", s.colText)
                            ;
                        }

                        s.sSplitChar = s.svgSel.append("tspan")
                            .text(s.txtSeparator)
                            .attr("y", y)
                            .style("fill", function(e) { return curSettings.scroller == null ? "#abcdef" : curSettings.scroller.pBgColor.solid.color; })
                        ;

                        s.svgSel.each(function () {
                            s.actualWidth = this.getBBox().width;
                        });

                        if (i > 0) {
                            var sPrev: TextCategory = this.arrTextCategories[i - 1];
                            s.posX = sPrev.posX + sPrev.actualWidth;
                        }
                        
                        // Nedanstående är till för att hantera om vi har mindre texter än hela utrymmet - då vill vi inte lägga in textern i mitten...
                        if (s.posX < this.viewportWidth) {
                            s.posX = this.viewportWidth;
                        }
                        
                        // Uppdatera alla efterliggande med den nyligen tillagdas position och bredd.
                        if (i < this.arrTextCategories.length - 1) {
                            for (var t = i + 1; t < this.arrTextCategories.length; t++) {
                                var sNext: TextCategory = this.arrTextCategories[t];
                                sNext.posX = s.posX + s.actualWidth;
                            }
                        }
                    }
                }
            }
            this.activeSpeed += (this.activeTargetSpeed - this.activeSpeed) * 0.5;
            if (this.activeSpeed < 0) {
                this.activeSpeed = 0;
            }
            if (this.activeSpeed > 100) {
                this.activeSpeed = 100;
            }

            this.gPosX -= this.activeSpeed * 8 * pIntervalStatic / 100;
            if (this.gPosX < -5000) {
                this.gPosX = 0;
            }

            for (var i = 0; i < this.arrTextCategories.length; i++) {
                var s: TextCategory = this.arrTextCategories[i];
                s.posX -= this.activeSpeed * 8 * pIntervalStatic / 100;
                if (s.svgSel != null) {
                    s.svgSel.attr("x", s.posX);
                }
            }

            // Remove elements outside of the left of the viewport
            for (var i = 0; i < this.arrTextCategories.length; i++) {
                var s: TextCategory = this.arrTextCategories[i];

                if ((s.posX + s.actualWidth) < 0) {
                    // Hela elementet är utanför, ta bort det (börja om)
                    var r1: TextCategory = this.arrTextCategories.splice(i, 1)[0];
                    if (r1.svgSel != null) {
                        r1.svgSel.remove();
                    }
                    r1.svgSel = null;
                    r1.actualWidth = 0;

                    r1.posX = 0;
                    if (this.arrTextCategories.length > 0) {
                        var sLast: TextCategory = this.arrTextCategories[this.arrTextCategories.length - 1];
                        r1.posX = sLast.posX + 10;
                    }
                    else {
                        r1.posX = this.viewportWidth;
                    }
                    if (r1.posX < this.viewportWidth) {
                        r1.posX = this.viewportWidth;
                    }

                    this.arrTextCategories.push(r1);

                    break;
                }
            }        
        }
        
    }
}
