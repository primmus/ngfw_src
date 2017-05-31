Ext.define('Ung.view.extra.Devices', {
    extend: 'Ext.panel.Panel',
    xtype: 'ung.devices',

    /* requires-start */
    requires: [
        'Ung.view.extra.DevicesController'
    ],
    /* requires-end */
    controller: 'devices',

    layout: 'border',

    dockedItems: [{
        xtype: 'toolbar',
        ui: 'navigation',
        dock: 'top',
        border: false,
        style: {
            background: '#333435',
            zIndex: 9997
        },
        defaults: {
            xtype: 'button',
            border: false,
            hrefTarget: '_self'
        },
        items: Ext.Array.insert(Ext.clone(Util.subNav), 0, [{
            xtype: 'component',
            margin: '0 0 0 10',
            style: {
                color: '#CCC'
            },
            html: 'Current Devices'.t()
        }])
    }],

    defaults: {
        border: false
    },

    items: [{
        xtype: 'ungrid',
        region: 'center',
        itemId: 'devicesgrid',
        reference: 'devicesgrid',
        title: 'Current Devices'.t(),
        store: 'devices',
        stateful: true,

        enableColumnHide: true,

        viewConfig: {
            stripeRows: true,
            enableTextSelection: true,
            listeners: {
                // to avoid some focusing issues
                cellclick: function (view, cell, cellIndex, record, line, rowIndex, e) {
                    if (Ext.Array.contains(cell.getAttribute('class').split(' '), 'tag-cell')) {
                        return false;
                    }
                }
            }
        },

        tbar: ['@add', '->', '@import', '@export'],
        recordActions: ['edit', 'delete'],
        emptyRow: {
            macAddress: '',
            macVendor: '',
            hostname: '',
            hostnameLastKnown: '',
            interfaceId: -1,
            lastSessionTime: 0,
            tags: {
                javaClass: 'java.util.LinkedList',
                list: []
            },
            username: '',
            javaClass: 'com.untangle.uvm.DeviceTableEntry'
        },

        plugins: [
        'gridfilters',
        {
            ptype: 'cellediting',
            clicksToEdit: 1
        }],

        fields:[{
            name: 'macAddress',
            type: 'string',
            sortType: 'asUnString'
        }, {
            name: 'macVendor',
            type: 'string',
            sortType: 'asUnString'
        }, {
            name: 'interfaceId',
            type: 'string',
            sortType: 'asUnString'
        }, {
            name: 'hostnameLastKnown',
            type: 'string',
            sortType: 'asUnString'
        }, {
            name: 'hostname',
            type: 'string',
            sortType: 'asUnString'
        }, {
            name: 'username',
            type: 'string',
            sortType: 'asUnString'
        }, {
            name: 'httpUserAgent',
            type: 'string',
            sortType: 'asUnString'
        }, {
            name: 'lastSessionTime',
        }, {
            name: 'tags'
        },{
            name: 'tagsString'
        }],

        columns: [{
            header: 'MAC'.t(),
            columns:[{
                header: 'Address'.t(),
                dataIndex: 'macAddress',
                filter: { type: 'string' },
                editor: {
                    xtype: 'textfield',
                    emptyText: '[no MAC Address]'.t()
                }
            }, {
                header: 'Vendor'.t(),
                dataIndex: 'macVendor',
                filter: { type: 'string' },
                editor: {
                    xtype: 'textfield',
                    emptyText: '[no MAC Vendor]'.t()
                }
            }]
        }, {
            header: 'Interface'.t(),
            dataIndex: 'interfaceId',
            filter: { type: 'string' },
            rtype: 'interface'
        }, {
            header: 'Last Hostname'.t(),
            dataIndex: 'hostnameLastKnown',
            filter: { type: 'string' },
            editor: {
                xtype: 'textfield',
                emptyText: ''.t()
            }
        }, {
            header: 'Hostname'.t(),
            dataIndex: 'hostname',
            filter: { type: 'string' },
            editor: {
                xtype: 'textfield',
                emptyText: '[no hostname]'.t()
            }
        }, {
            header: 'Username'.t(),
            dataIndex: 'username',
            filter: { type: 'string' },
            editor: {
                xtype: 'textfield',
                emptyText: '[no device username]'.t()
            }
        }, {
            header: 'HTTP'.t() + ' - ' + 'User Agent'.t(),
            dataIndex: 'httpUserAgent',
            // flex: 1,
            filter: { type: 'string' },
            editor: {
                xtype: 'textfield',
                emptyText: '[no HTTP user agent]'.t()
            }
        }, {
            header: 'Last Seen Time'.t(),
            dataIndex: 'lastSessionTime',
            width: 180,
            filter: { type: 'date' },
            rtype: 'timestamp'
        }, {
            header: 'Tags'.t(),
            width: 300,
            xtype: 'widgetcolumn',
            tdCls: 'tag-cell',
            // flex: 1,
            widget: {
                xtype: 'tagpicker',
                bind: {
                    tags: '{record.tags}'
                }
            }
        },
        // {
        //     header: 'Tags values',
        //     width: 500,
        //     dataIndex: 'tags',
        //     renderer: function (val) {
        //         var str = [];
        //         if (val.list.length > 0) {
        //             Ext.Array.each(val.list, function (tag) {
        //                 str.push(tag.name + ' = ' + tag.expirationTime);
        //             });
        //         }
        //         // console.log(val);
        //         return str.join(', ');
        //     }
        // },
        {
            header: 'Tags String',
            dataIndex: 'tagsString',
            filter: { type: 'string' },
        }],
        editorFields: [{
            xtype: 'textfield',
            disabled: true,
            bind: {
                value: '{record.macAddress}',
                disabled: '{record.internalId >= 0}'
            },
            fieldLabel: 'MAC Address'.t(),
            emptyText: '[enter MAC address]'.t(),
            allowBlank: false,
            vtype: 'macAddress',
            maskRe: /[a-fA-F0-9:]/
        }, {
            xtype: 'textfield',
            bind: '{record.macVendor}',
            fieldLabel: 'MAC Vendor'.t(),
            emptyText: '[no MAC Vendor]'.t(),
        }, {
            xtype: 'textfield',
            bind: '{record.hostnameLastKnown}',
            fieldLabel: 'Last Hostname'.t(),
            emptyText: '[no last hostname]'.t(),
        }, {
            xtype: 'textfield',
            bind: '{record.hostname}',
            fieldLabel: 'Hostname'.t(),
            emptyText: '[no hostname]'.t(),
        }, {
            xtype: 'textfield',
            bind: '{record.username}',
            fieldLabel: 'Username'.t(),
            emptyText: '[no username]'.t(),
        }, {
            xtype: 'textfield',
            bind: '{record.httpUserAgent}',
            fieldLabel: 'HTTP'.t() + ' - ' + 'User Agent'.t(),
            emptyText: '[no HTTP user agent]'.t()
        }],
    }, {
        region: 'east',
        xtype: 'unpropertygrid',
        title: 'Device Details'.t(),
        itemId: 'details',
        collapsed: true,

        bind: {
            source: '{deviceDetails}'
        }
    }],
    tbar: [{
        xtype: 'button',
        text: 'Refresh'.t(),
        iconCls: 'fa fa-repeat',
        handler: 'getDevices',
        bind: {
            disabled: '{autoRefresh}'
        }
    }, {
        xtype: 'button',
        text: 'Reset View'.t(),
        iconCls: 'fa fa-refresh',
        itemId: 'resetBtn',
        handler: 'resetView',
    },
    '-',
    {
        xtype: 'ungridfilter'
    },{
        xtype: 'ungridstatus',
        tplFiltered: '{0} filtered, {1} total devices'.t(),
        tplUnfiltered: '{0} devices'.t(),
    }, '->', {
        xtype: 'button',
        text: 'View Reports'.t(),
        iconCls: 'fa fa-line-chart',
        href: '#reports/devices',
        hrefTarget: '_self'
    }, {
        xtype: 'button',
        text: 'Help'.t(),
        iconCls: 'fa fa-question-circle',
        href: rpc.helpUrl + '?source=devices&' + Util.getAbout()
    }],
    bbar: ['->', {
        text: '<strong>' + 'Save'.t() + '</strong>',
        iconCls: 'fa fa-floppy-o',
        handler: 'saveDevices'
    }]
});
