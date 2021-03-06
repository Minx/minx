(function() { 
"use strict";

/*
ListScrollPanel - registered as list-scroll-panel
=================================================

one event 'click' on a list item
*/


Minx.ListScrollPanel = my.Class(Minx.DataBoundPanel, {

    constructor: function(parent, id) {
        // call my base constructor
        Minx.ListScrollPanel.Super.call(this, parent, id);

        this._touch = Minx.pm.isTouch(); // saves calling loads
        
        this._scroller = null;         // scroller is not really the view in this case - it is behaviour added, for iScroll the view is the markup

        this._need_new_scroller = true;       // ser if the parent got resized or reattached so we know ro refresh the scroller after a parent panel draw

        this._listLength = 0;           // set by munge used to decide if we really need a scroller
        this._filter = null;            // filter function

        this._lastSelect = null;        // whicj li was last clicked

        this._rowView = null;           // a rowview class tht is triggered on individual row changes

        // my defauly stylee
        this.addClass('scroll-content');
        
        // add scrollbars if not touch
        if (!this._touch) {
            // if not touch device then add this...
            this.addClass('scroll-overflow');
        }

        // default renderer
        this._rowRenderer = this.getRowMarkup;
        this._emptyRenderer = this.getEmptyMarkup;
        this._preRowRenderer = this.getPreRowMarkup;
        

        this._listMax = 0;              // wnat a maximum number in this list - set this.

        // for iscroll the view is the dom node of this widget container
        this.setView(this.getNode());

        this._dataByKey = {};           // pointers to each data object
    },


    // called by our default event dispatcher
    eventParse: function(event) {
        // augement with explicit id
        // e must be in the param object
        // currentTarget - the element that recieved the event

        // WARNING - zepto Library dependancy with $
        // remove selected class from last li
        if (this._lastSelect != null) {
            $(this._lastSelect).removeClass("selected");
        }
        
        // add a selected class to the current thing
        $(event.currentTarget).addClass("selected");
        
        this._lastSelect = event.currentTarget;

        return {id: event.currentTarget.id, e: event};
    },


    setMaxListcount: function(count) {

        this._listMax = count;              // wnat a maximum number in this list - set this.  
    },


    clearSelection: function() {

        if (this._lastSelect != null) {
            $(this._lastSelect).removeClass("selected");    
        }
    },


    setSelection: function(id) {

        this.clearSelection();

        var node = this.getNode();

        var ul = $('ul', node)[0];

        var qs = '#' + id;
        var li = $(qs, ul)[0];

        if (li) {
            this._lastSelect = li;
            $(li).addClass('selected');
        }
    },


    // client can set this to do stuff when scrolling starts
    onScrollStart: function(scroller, ev) {
        
    },


    // iScroll can only attach properly when the div it is in is layed out - so create my scroller on first drawing
    draw: function(force) {

        var wasdirty = this.isDirty();
        Minx.ListScrollPanel.Super.prototype.draw.call(this, force);

        var me = this;

        // if touch and we need a fresh one and we are not hidden and we have a long enough list
        // have not added force in here, but might have to. It is assumed that the force redraw is after any list content change
        // so multiple forced redraws wont force multiple iscroll recreations
        // only bother drawing me if I am clearly visible on screen
        if (this._touch && this._need_new_scroller && this.isOnScreen() && (this._listLength > 2)) {

            //LOG 
            console.log("ISCROL - - - - - - > Making new scroller for  " + me.reportLineage());
            
            // iscroll suggests we make sure this is inside a timer so that the dom is fully drawn
            setTimeout(function() {
            
                if(me._scroller != null) { 
                    me._scroller.destroy();
                    me._scroller = null; 
 //                    me._scroller.refresh();
                }
//                else {
                    // create the new scroller
                    me._scroller = new iScroll(me.getNode(), {onBeforeScrollMove: me.onScrollStart});
//                }

            }, 300);
                
                // clear my flag
            me._need_new_scroller = false;

            //console.log("Scroller complete");
        }
    },


    // a callback to return the row content
    setRowRenderer: function(fn) {

        this._rowRenderer = fn;
    },


    setEmptyRenderer: function(fn) {

        this._emptyRenderer = fn;
    },

    
    setPreRowRenderer: function(fn) {

        this._preRowRenderer = fn;
    },

    getData: function(key) {

        if (this._model instanceof Array) {
            for (var m in this._model) {
                var dat = this._model[m].get(key);
                if (dat) {
                    return dat;
                }
            }
            return null;
        }
        else {
            
            return this.getModel().get(key);
        }
    },


    setFilter: function(filtFunc) {

        this._filter = filtFunc;
    },


    // if we have set a per row view handler then any update to the row will trigger a redraw of the row, so dont have to redraw the whole list
    setRowView: function(rowviewclass) {
        this._rowView = rowviewclass;  
    },


    // munge my model into my view called by client manually - likely to be set to an event when the data model changes
    munge: function() {
        // as our munge function completely recreates the ul and all li's in it we may as well recreate the scroller.
        // if we simply call refresh the scroller expects the ul to be the same one that was in place when we created the scroller in the first place
        var me = this;

        var rawList = this.getModel();      // a backbone collection
        

        if (rawList == null) {

            throw "munge called, but no model set";
        }

        var modelArray = false;
        if (rawList instanceof Array) {
            modelArray = true;
        }

        //LOG console.log("----------------------> MUNGING <---------------------  " + this.reportLineage());

        this.setContentChanged(true);           // only needed if length has changed??
        

        function filter(rl) {

            var list = rl.models;

            // do we have a filter
            if (me._filter != null) {

                list = rl.filter(me._filter);        // references to the original model, but a subset?

            }    
            return list;
        }

        var rawLength = 0;
        var filteredLength = 0;

        var lists = [];
        if (modelArray) {

            for (var m in rawList) {
                rawLength += rawList[m].length;
                var fl = filter(rawList[m]);
                filteredLength += fl.length;
                lists.push(fl);
            }
        }
        else {
            rawLength = rawList.length;
            var fl = filter(rawList);
            filteredLength = fl.length;
            lists.push(fl);
        }

        
        var view = this.getView();                       // a backbone view 

        
        // tring not to trash the root so the scroller  can nicely redrar - reducing flicker
        if (this._widgetRoot) {

            //view.removeChild(this._widgetRoot); 
            var node = this._widgetRoot
            while(node.firstChild) {
                node.removeChild(node.firstChild);
            }
        }
        else {

            // for iscroller we call dom functions on our view
            // my root node is the ul that the iscroller expects
            this._widgetRoot = document.createElement('ul');
            this._widgetRoot.setAttribute('class', this.getClassName());
            
            // fast clicks on all clicks below the ul
            new NoClickDelay(this._widgetRoot);

            view.appendChild(this._widgetRoot);
        }

        var pId = this.getId();
        // now apply stuff from our model - for now its just hard coded li's
        var li;         // a li for our row
        var liNode;     // the node to attach to the li
        var liPre;
        
        var row;        // each row
        var prevRow = null;     // the prev row

        var prevli = null      // previous li = used for setting last on rows prior to breaks


        if(rawLength === 0) {

            li = document.createElement('li');
            li.setAttribute('id', 'id-none'); // this._keyField]);       // set element attribute to my id
                
            liNode = this._emptyRenderer(pId, {}, li, prevli, this._firstModel);
                
            if (liNode != null) {

                li.appendChild(liNode);
            }

            this._widgetRoot.appendChild(li);

            // this is called when the list is first bound
            if (this._firstModel)
            {
                //console.log("first munge on empty list so doing nothing");
                return;
            }

            
        }
        else {

            var tc = 0;
            
            for (var l in lists) {
                var list = lists[l];
            
                // consider each if it is a backbone model
                for (var h in list) {
                    
                    row = list[h];


                    // make a new li for this row
                    li = document.createElement('li');
                    li.setAttribute('id', row.get('id')); // this._keyField]);       // set element attribute to my id


                    liPre = this._preRowRenderer(pId, row, li, prevli, prevRow);
                    if (liPre) {
                        this._widgetRoot.appendChild(liPre);
                    }                    


                    // have we set a seperate per row view - bound to individual row changes
                    if (this._rowView) {
                        var view = new BackboneMinxWrap.WidgetRowView({el: li});
                        
                        view.setTemplate(this._rowView.plate);
                        view.setPrettyFunc(this._rowView.pretty);
                        view.setCustomClass(this._rowView.customclass);

                        row.bind('change', view.render);
                    }

                    if (tc == 0) {

                        li.setAttribute('class', 'first');
                    }
                    
                    if (tc == filteredLength - 1) {

                        li.setAttribute('class', 'last');
                        if (tc == 0) {
                            li.setAttribute('class', 'first last');
                        }
                    }

                    // capture clicks
                    Minx.eq.subscribe(this, li, 'click');

                    // call potentially a callback that will return my row content as a node
                    liNode = this._rowRenderer(pId, row, li, prevli, prevRow);
                    
                    if (liNode != null) {

                        li.appendChild(liNode);
                    }

                    this._widgetRoot.appendChild(li);

                    prevli = li;

                    // if we have set a max and reached it then break
                    if ((this._listMax > 0) && (tc > this._listMax)) {
                        break;
                    }

                    tc++;
                    prevRow = row;
                }

                // if we have set a max and reached it then break
                if ((this._listMax > 0) && (tc > this._listMax)) {
                    break;
                }   
            }
        }
        
        this._listLength = filteredLength;
        
        if (this._listMax > 0) {
            this._listLength = filteredLength < this._listMax ? filteredLength : this._listMax;
        }
        
        /*
        if(me._scroller != null) {
            setTimeout(function() {
                me._scroller.refresh();
            }, 1000);
        }
        */

        if(me._scroller != null) {
                    me._scroller.destroy();
                    me._scroller = null; 

                    me._scroller = new iScroll(me.getNode(), {onBeforeScrollMove: me.onScrollStart});
        }

        

        //LOG console.log("NEED NEW SCROLLER from MUNGE " + this.getId());
        this._need_new_scroller = true;
        
    },


    // default function assigned to the _rowRenderer callback
    getRowMarkup: function(parentId, row) {
        // for now assume a model with a property 'name'
        var div = document.createElement('div');
        var text = document.createTextNode('unimplemented row view');
        div.appendChild(text);

        return div;  
    },


    getEmptyMarkup: function(parentId, row) {

        var div = document.createElement('div');
        var h2 = document.createElement('h2');
        var text = document.createTextNode('No items to display');
        h2.appendChild(text);
        div.appendChild(h2);

        return div;  
    },


    getPreRowMarkup: function() {
        return null;
    },


    getDisplayedLength: function() {
        return this._listLength;
    },


    // override this which is called when the panel resizes
    resized: function() {

        var me = this;
        // super to call any callback
        Minx.ListScrollPanel.Super.prototype.resized.call(this);

        //console.log("Askling for new scroller cos resized " + this.getId());
        // capture that we did resize so that we know to refresh the scroller after drawing parent
        //LOG console.log("NEED NEW SCROLLER from RESIZED " + this.getId());
        this._need_new_scroller = true;
    },


    // override this which is called when the panel is reattached
    reattached: function() {

        var me = this;
        // super to call any callback
        Minx.ListScrollPanel.Super.prototype.reattached.call(this);

        //console.log("Askling for new scroller cos reattached " + this.getId());
        // capture that we did resize so that we know to refresh the scroller after drawing parent
        //LOG console.log("NEED NEW SCROLLER from REATTACH " + this.getId());
        this._need_new_scroller = true;
    },

    
    // private override to decide what html element my node will be
    getMyElement: function() {

        return 'div';
    },


    getClassName: function() {

        return 'scroll-list';
    }
});


// register for the panelmanager factory
Minx.pm.register('list-scroll-panel', Minx.ListScrollPanel);


})();
