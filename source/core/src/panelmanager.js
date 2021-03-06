if (typeof Minx === "undefined") {
    var Minx = {};
}

(function() {
/* main */
"use strict";

//

Minx.logger = {

    last: new Date(),

    touch: function() {
        this.last = new Date();
    }
};

// an event wrapper linking the passed in panel with the event e and the function to call
// by setting upp this little wrapper with the trigger function - i can explicitly call the panel callback - so 'this' is correct in the panel callback
// otherwise 'this' will be the dom element the event listener was atached to
// instead of this little wrapper we could refer to me in all the event handlers = ball ache
// i think this little wrapper is much the same as others implementation of 'bind' type things

Minx.Event = function(panel, callback) {

    this.trigger = function (e) {
        
            // take a note of this event to keep an eye on inactivity
            Minx.logger.touch();

            e.stopPropagation();            // stop nearby html getting the event as well
            
            panel[callback](e);
    };
};


// the event 'queue' - not even a queue but could be if we wanted to manage all events
// for now this creates a simple wrapper function object so that when the handler is called on the panel - 'this' is in scope
// it also adds the event to the list of events for the individual panel - so each panel could manage its own event list
Minx.Events = function(){
    // consider - is there any need for a global minx list of all subscribing panels?

    // panel a reference to a panel - ev the event we want, callback = string name of the function to call on the panel
    // is this my 'bind' equivalent?
    this.subscribe = function(panel, node, ev, callback, capture) {

        if (typeof callback === "undefined") callback = 'eventFired';
        if (typeof capture == "undefined") capture = false;
        
        // wrapper to call the event on the panel
        var mEv = new Minx.Event(panel, callback);

        // the default node is the panels node
        if(node == null) {
            node = panel.getNode();
        }

        // let the panel know it has ths event - panels maintain a list of events they are subscribed to - this is not used at the moment however
        if (typeof panel.addEvent !== "undefined") {
           panel.addEvent({node: node, ev: ev, mEv: mEv});
        }

        // then add it to the dom - passing in closure (of panel and callback)
        node.addEventListener(ev, mEv.trigger, capture);

        return mEv;
    }

    this.unsubscribe = function(panel, node, ev, mEv) {
        // the default node is the panels node
        if(node == null) {
            node = panel.getNode();
        }
        
        node.removeEventListener(ev, mEv.trigger);

        if (typeof panel.removeEvent !== "undefined") {
            panel.removeEvent({node: node, ev: ev, mEv: mEv});
        }
    }
};


// ipad = 1024 x 610
//      = 768 x 866

// new event queue
Minx.eq = new Minx.Events();

// debounce behaviour - avoide loads of actions wiht multiple clicks
Minx.Debounce = {};
Minx.Debounce.actionTimers = {};
Minx.Debounce.action = function(key, action, lag) {
    if((typeof lag) === 'undefined') lag = 300;

    if (this.actionTimers[key]) {
        clearTimeout(this.actionTimers[key]);
    }
    this.actionTimers[key] = setTimeout(function() {
        action();
    }, lag);
};


// maintains a sigle hash of all panels
// adds a new panel
// removes panels
// gives the ability to set z-order
Minx.PanelManager = function() {

    this.localMobileTest = false;
    this.localiPhoneTest = false;
    this.localiPadTest = false;

    var _panels = {};           // hash of all panels by id
    var _idCounter = 0;         // internal id counter
    var _pref = 'pn';           // panel id prefix - e.g. pn1, pn2...
    var _root_node;             // our root node - document.body by default
    var _types = {};
    
    this.dims = {};              // public object wit device dimensions
    
    this.calcDims = function() {
        var nw = document.documentElement.clientWidth;
        var nh = document.documentElement.clientHeight
        var orn = -1;

        if(window.orientation) {
            orn = window.orientation;
        }

        // height is sorted automatically
        this.dims.h = nh;
        this.dims.w = nw;

        this.dims.or = 'l';
        if(nw < nh) {
            this.dims.or = 'p';
        }

        // console.log("orn = " + orn);
        // console.log("nh = " + nh);
        // console.log("nw = " + nw);

        // need to detect real evice width because the client width has been fixed to allow smooth repositioning
        // if it is set to auto size then the snap to 0,0 is ugly
        // ipad tells us the height nicely
        if(this.dims.ipad) {
            
            if(nh > 768 || orn == 0 || orn == 180) {  // must be portrait

                this.dims.or = 'p';
                // TODO - get te ipad2 dimensions!!
                this.dims.w = 768;
                console.log("ipad -> port");
            }
            else {

                this.dims.or = 'l';
                console.log("ipad -> land");
            }
        }
        
        if(this.dims.ipod || this.dims.iphone) {

            if(nh > 320 || orn == 0 || orn == 180) {  // must be portrait

                this.dims.or = 'p';
                // TODO - get the iphone 4 dimensions - and be cleverer for Android if we ever support it!!
                this.dims.w = 320;
                this.dims.h = 460;
                console.log("phone + ipod port")
            }
            else {

                this.dims.or = 'l';
                this.dims.w = 480;
                this.dims.h = 300;
                console.log("phone + ipod land")
            }
        }

        // what no android!! - Android performance sucs
    };

    this.calcDevice = function() {
        // check if we are in stand alone mode
        if(window.navigator.standalone) {
            this.dims.sa = true;
        }
        else {
            this.dims.sa = false;
        }

        this.dims.iphone       = this.agent().iphone;
        this.dims.ipad         = this.agent().ipad;
        this.dims.ipod         = this.agent().ipod;
        this.dims.android      = this.agent().android; 
        this.dims.webos        = this.agent().webos;
        this.dims.blackberry   = this.agent().blackberry; 

        this.dims.pr = 1;
        if (window.devicePixelRatio) {
            this.dims.pr = window.devicePixelRatio;
        }

        if ((this.dims.ipod || this.dims.iphone) && this.dims.pr >=2) {
            this.dims.retina = true;
        }

        // DEV - D-EBUG - this.dims.retina = true;

        //DEV - simulate touch
        if (this.localiPhoneTest) {
            this.localMobileTest = true;
            this.dims.iphone = true;
        }

        if (this.localiPadTest) {
            this.localMobileTest = true;
            this.dims.ipad = true;
        }
        
        var t = this.dims;      // just to save typing
        this.dims.touch = t.iphone || t.ipod || t.ipad || t.android || t.blackberry;
        this.dims.phone = t.iphone || t.ipod || t.android || t.blackberry;
        this.dims.small = t.iphone || t.ipod || t.android || t.blackberry;      // use dimensions in future - so cope with retina
        this.dims.ios = t.iphone || t.ipod || t.ipad;
        this.dims.phonegap = typeof PhoneGap !== "undefined";

        this.ver = 0;
        
        var nw = document.documentElement.clientWidth;
        var nh = document.documentElement.clientHeight

        // landscape width
        this.dims.lw = nw;

        // 'device-height' in the meta tags will fix this 
        if(this.dims.ipad) {
            if(nw == 1024) { // ipad 1
                this.ver = 1;
                this.dims.pw = 768; // portrait width
            }
            if(nw > 1024) { // ipad 2
                this.ver = 2;
            }
        }
        if(this.dims.iphone) {
            if(nw == 320) { // ipone 3
                this.ver = 3;
                this.dims.pw = 320; // portrait width
            }
            if(nw > 1024) { // iphone 4 retina 
                this.ver = 4;
            }
        }

        this.calcDims();
    };

    this.testPerf = function(cb) {
        
        this.dims.slow = false;
        
        var t = 0;
        this.u = true;
        var me = this;

        function loop() {

            if (me.u) {
                setTimeout(loop, 1);
                t++;
                for (var v = 0; (v < 10) && me.u; v++) {

                }
            }                 
        }

        function stoploop() {
            me.u = false;

            if (t < 20) {

                me.dims.slow = true;
                console.log("slow device detected")
            }

            cb(me.dims.slow);
        }

        setTimeout(stoploop, 300);
        loop();
    }


    // set up the root node and optionally add a single panel that resizes with the browser resizing
    this.init = function(auto, finished) {

        this.calcDevice();

        //and our root panel representation of document.body
        _root_node = new Minx.Panel(null, "root");

        var main = null;

        var me = this;

        var changing = false;

        function oChange() {
            
            if (!changing) {

                changing = true;

                me.calcDims();

                console.log("ochange w=" + me.dims.w + " h="+ me.dims.h);

                main.setSize(me.dims.w, me.dims.h);

                main.removeClass('or-l');
                main.removeClass('or-p');
                main.addClass('or-' + me.dims.or);
                
                // this constructs main panel geometry and updates kids - redraws all kidies if thier geometry has changed
                // but doesnt redraw the main panel
                
                // main.layout();
                // main.drawKids();

                //if(Minx.pm.dims.phone) {
                    main.render();            // rendering the main section can cause flicker - but got to do it on phone to stop keyboard moving viewport
                //}

                changing = false;
            }
        }
        
        // auto generate a main and set it to rezize on window resize
        if(auto) {
            main = Minx.pm.add(_root_node, 'simple');
            main.addClass('main-panel');
            if(Minx.pm.dims.phone) {
                main.addClass('phone');
                main.setStyle('overflow', 'hidden');                    // stop phone keyboard scrolling the viewport
            }
            else {
                main.setStyle('overflow', 'visible');                   //  for ipad - show more cntent cos we elegantly animate scroll to zero - otherwise safari pings it to zero
            }

            main.addClass('or-' + me.dims.or);

            main.setAnimate(0);                                     // TODO - try it both ways

            main.getNode().innerHTML = '<div id="back-top"></div>';

            console.log("Got dims w = " + this.dims.w + " h = " + this.dims.h);
            console.log(this.dims);
            
            main.setSize(this.dims.w, this.dims.h);         
            main.render();

            main.getNode().ontouchmove = function(event) {
                // Prevent scrolling on this element
                event.preventDefault();
                event.stopPropagation();
            };

            changing = false;

            if(this.isTouch() && !this.localMobileTest) {
                window.addEventListener('orientationchange', function(){
                    var orientation = window.orientation;

                    console.log(orientation);
                    oChange();

                }, true);
            }
            else {
                window.addEventListener('resize', oChange, true);
            }

        }
        else {
            console.warn("YOU will have to manage orientation changes yourself and add a root panel");
        }

        this._main = main;
        return this._main;
    };


    this.agent = function(){
        return {
            iphone : /iphone/i.test(navigator.userAgent),
            ipad : /ipad/i.test(navigator.userAgent),
            ipod : /ipod/i.test(navigator.userAgent),
            android : /android/i.test(navigator.userAgent),
            webos : /weblos/i.test(navigator.userAgent),
            blackberry : /blackberry/i.test(navigator.userAgent),
            online :  navigator.onLine,
            standalone : navigator.standalone
        };
    };


    this.isTouch = function() {
        
        return this.dims.touch;

    }


    // add a panel type to my map to look up
    this.register = function(key, type) {
        _types[key] = type;
    }
    
    // default add is a pinned panel - all popups pass in the string 'main' to attach to the auto generated main
    this.add = function(parent, type, mask){
        // default is a pinned panel
        if (typeof type == "undefined") {
            type = 'pinned';
        }

        // check if the new panel specifically wants wants main as its parent
        if (typeof parent == "string") {
            if(parent == 'main') {
                parent = this._main;
            }
            else {
                throw 'Not a recognised parent panel: - ' +  parent;
            }
        }

        // if no parent then attach it to the root node - normally will only happen once - with the main panel
        if(parent == null) {
            parent = _root_node;
        }

        // modal mask needed??
        var newMask = null;
        if (mask) {
            newMask = this._addType(this._main, 'mask');
            
            // pause for dom
            // setTimeout(function() {
                
            //     newMask.show();    
            // }, 100);                                // 100 ms to allow content to draw itself

            parent = newMask;
            
        }
        
        var newPanel = this._addType(parent, type);
    
        if (newMask) {
            newPanel.mask = newMask;
            newPanel.setStyle('z-index', '46');
        }
    

        return newPanel;
    }

    // add a new panel - to a parent or root, create a managed id, add to our flat managed list of all panels
    // and return it - so client can mess with it
    this._addType = function(parent, type){
        
        // generate a managed id
        var id = _pref + (_idCounter++);

        // id counter could be used to increment z-index
        
        // make and create a new panel
        if(!_types.hasOwnProperty(type)) {
            
            throw 'panelmanager._addType(): Cant create panel of type: "' + type + '. Did you forget to add the script? ';
        }else {
            var tPan = new _types[type](parent, id);
        }
        
        // add to panels hash
        _panels[id] = tPan;

        return _panels[id];
    };


    // remove a panel and all children from our dom and managed lists
    // equivalent to delete 
    this.remove = function(panel) {
        var key;                                // loop var

        if (panel == null) {
            return;
        }

        // did this panel get added a mackground mask?
        if (panel.mask) {

            this.remove(panel.mask);
        }

        // if pnel is an id - find it in our managed list of _panels
        if(typeof panel == 'string') {
            panel = _panels[panel];
        }   

        // got one? cool, remove myself - (which will remove all children)
        if(panel) {

            // fade it out first
            panel.hide();
            
            // then remove from the dom .3 seconds later
            setTimeout(function() {
                var list = panel.removeMe();

                // delete al the removed panels from our managed list
                for(var key in list) {
                    if (list.hasOwnProperty(key)) {             // make sure it is not any prototypical property
                        delete _panels[list[key]];
                    }
                }

            },300);         // TODO - get the panel animate time 
        }
    };

    // need to stip these out with preprocessor or something
    this.log = function(id) {
        var pan;

        if (id) {
            console.log(_panels[id].reportLineage());
            console.log(_panels[id]);
        }
        else {
            for (pan in _panels) {
                if (_panels.hasOwnProperty(pan)) {
                    console.log(pan);
                    console.log(_panels[pan]);
                }
            }
        }
        return('done');
    };

    // need to stip these out with preprocessor or something
    this.logResizes = function() {
        var pan;

        for(pan in _panels) {
            if (_panels.hasOwnProperty(pan)) {
                console.log(pan + " - "  + _panels[pan].resizeCount);
            }
        }
    
        return('done');
    };

    this.reveal = function(id) {
        var pan;

        function revealMe(panel) {

            if (panel.getParent()) {

                revealMe(panel.getParent());
            }
            panel.show();
        }

        if (_panels[id]) {

            $('body').addClass('debug');

            for(pan in _panels) {
                
                if (_panels.hasOwnProperty(pan)) {

                    console.log(pan);

                    _panels[pan].setStyle('opacity', '0.7');
                    _panels[pan].setStyle('background', 'transparent');
                    _panels[pan].render();
                }

            }

            revealMe(_panels[id]);
            _panels[id].addClass('debug');
            _panels[id].render();
            this.log(id);
        }
        else {
            console.log('no panel - ' + id);
        }
        return('done');
    }

    this.getPanel = function(id) {
        return _panels[id];
    }

    this.tree = function() {
        _panels['pn0'].reportDescendants(1);   
    }
};

// singleton panel manager - instantiating 2 or more of these will get us multiples of the same element id's
Minx.pm = new Minx.PanelManager();



// shim layer with setTimeout fallback
          window.requestAnimFrame = (function(){
            return  window.requestAnimationFrame || 
                    window.webkitRequestAnimationFrame || 
                    window.mozRequestAnimationFrame || 
                    window.oRequestAnimationFrame || 
                    window.msRequestAnimationFrame || 
                    function(/* function FrameRequestCallback */ callback, /* DOMElement Element */ element){
                      window.setTimeout(callback, 1000 / 60);
                    };
          })();


})();


document.addEventListener('touchmove', function (e) { e.preventDefault(); }, false);


// fast click - put in its own file.....
function NoClickDelay(el) { };
/*
    this.element = el;
    if( window.Touch ) this.element.addEventListener('touchstart', this, false);
}

NoClickDelay.prototype = {
    handleEvent: function(e) {
        switch(e.type) {
            case 'touchstart': this.onTouchStart(e); break;
            case 'touchmove': this.onTouchMove(e); break;
            case 'touchend': this.onTouchEnd(e); break;
        }
    },

    onTouchStart: function(e) {
        e.preventDefault();
        this.moved = false;

        this.element.addEventListener('touchmove', this, false);
        this.element.addEventListener('touchend', this, false);
    },

    onTouchMove: function(e) {
        this.moved = true;
    },

    onTouchEnd: function(e) {
        this.element.removeEventListener('touchmove', this, false);
        this.element.removeEventListener('touchend', this, false);

        if( !this.moved ) {
            // Place your code here or use the click simulation below
            var theTarget = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
            if(theTarget.nodeType == 3) theTarget = theTarget.parentNode;

            var theEvent = document.createEvent('MouseEvents');
            theEvent.initEvent('click', true, true);
            theTarget.dispatchEvent(theEvent);
        }
    }
};
*/