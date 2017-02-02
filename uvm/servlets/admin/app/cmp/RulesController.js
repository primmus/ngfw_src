Ext.define('Ung.cmp.RulesController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.rules',

    addCount: 0,

    control: {
        '#': {
            beforerender: 'onBeforeRender',
        },
        'grid': {
            cellclick: 'onCellClick'
        }
    },

    onBeforeRender: function (view) {
        view.down('grid').setBind('{portforwardrules}');
        // create conditions map
        view.setConditionsMap(Ext.Array.toValueMap(view.getConditions(), 'name'));
        // console.log(view.getViewModel());
    },


    addRecord: function () {
        var grid = this.getView();
        var vm = this.getViewModel();
        var r = Ext.create('Ung.model.Rule', Ext.clone(this.getView().emptyRow));
        vm.get('portforwardrules').add(r);
        r.dirty = true;
        grid.view.refresh();
        console.log(vm.get('portforwardrules').getRange());
        // grid.getStore().insert(0, newRule);
        // vm.get('portforwardrules').sync();
        // grid.getStore().reload();
    },

    editRecord: function (view, rowIndex, colIndex, item, e, record, row) {
        // console.log(this.getView().down('grid').getColumns());

        // open recordeditor window
        Ext.widget('ung.cmp.recordeditor', {
            fields: this.getView().down('grid').getColumns(), // form fields needed to be displayed in the editor taken from grid columns
            label: this.getView().label, // the label in the form
            conditions: this.getView().getConditions(), // the available conditions which can be applied
            conditionsMap: this.getView().getConditionsMap(), // a map with the above conditions as helper
            // recordCopy: record.copy(null), // a clean copy of the record to be edited
            record: record
            // bind: {
            //     data: {
            //         record: '{record}'
            //     }
            // }
            // conditionsMap: this.getView().getConditionsMap(),
            // viewModel: {
            //     data: {
            //         originalRecord: record
            //     },
            //     // formulas: {
            //     //     conditionsData: {
            //     //         bind: '{record.conditions.list}',
            //     //         get: function (coll) {
            //     //             return coll || [];
            //     //         }
            //     //     },
            //     // }
            // }
        });
    },


    deleteRecord: function (view, rowIndex, colIndex, item, e, record, row) {
        record.set('markedForDelete', true);
        // console.log(record);
        // record.drop();
        // console.log(record);
        // this.getView().getStore().remove(record);
        //console.log(record);
        //record.setConfig('markDelete', true);
        //record.markDelete = true;
        //console.log(record);
    },

    moveUp: function (view, rowIndex, colIndex, item, e, record, row) {
        var store = this.getView().down('grid').getStore();
        store.remove(record, true); // just moving
        store.insert(rowIndex + item.direction, record);
    },


    onCellClick: function (table, td, cellIndex, record) {
        var me = this;
        if (td.dataset.columnid === 'conditions') {
            Ext.widget('ung.cmp.ruleeditor', {
                conditions: me.getView().getConditions(),
                conditionsMap: me.getView().getConditionsMap(),
                viewModel: {
                    data: {
                        rule: record
                    },
                    formulas: {
                        conditionsData: {
                            bind: '{rule.conditions.list}',
                            get: function (coll) {
                                return coll || [];
                            }
                        },
                    },
                }
            });
        }
    },

    conditionsRenderer: function (value, metaData, record) {
        var view = this.getView(),
            conds = record.get('conditions').list,
            resp = [], i, cond;
        for (i = 0; i < conds.length; i += 1) {
            resp.push(view.getConditionsMap()[conds[i].conditionType].displayName + '<strong>' + (conds[i].invert ? ' &nrArr; ' : ' &rArr; ') + '<span class="cond-val ' + (conds[i].invert ? 'invert' : '') + '">' + conds[i].value.split(',').join(', ') + '</span>' + '</strong>');
        }
        return resp.join(' &nbsp;&bull;&nbsp; ');
    },

    conditionRenderer: function (val) {
        return this.getView().conditionsMap[val].displayName;
    },

    editRuleWin: function (view, rowIndex, colIndex, item, e, record) {
        var me = this;
        Ext.widget('ung.cmp.ruleeditor', {
            conditions: me.getView().getConditions(),
            conditionsMap: me.getView().getConditionsMap(),
            viewModel: {
                data: {
                    rule: record
                },
                formulas: {
                    conditionsData: {
                        bind: '{rule.conditions.list}',
                        get: function (coll) {
                            return coll || [];
                        }
                    },
                },
            }
        });
    }

});