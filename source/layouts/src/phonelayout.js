
//layout namespace

if (typeof Minx.Layout === "undefined") {
    Minx.Layout = {};
}

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


Minx.Layout.PhoneLayout = my.Class({

    constructor: function(main) {


        this._navSlideTimer = null;        // clearable timeout so can cancel delayed hides
        this._stuffSlideTimer = null;        // clearable timeout so can cancel delayed hides
        

        var me = this;
        //var touch = Minx.pm.isTouch();

        // ---   navigation panel
        this._navPanel = Minx.pm.add(main,'title-panel');
        this._navPanel.setAnimate(200);
        

        // make it lighter
        this._navPanel.getTitle().removeClass('dark-bar');
        this._navPanel.getTitle().addClass('light-bar');

        
        // --- right hand  panel of stuff
        this._activeMain = null;                // the panel that is in the active "main" manel


        
/*
        var stuffBack = this._stuff.getTitle().addButton('l', 20, 'Pop');
        stuffBack.setType('back');
        
        stuffBack.show();

        // navigation back button handler - only one level so east to know what to do..
        stuffBack.onClick(function(panel,e){
            // slide the main nav into place
            
            me._navPanel.setPos(0, 0);
            
            me._navPanel.show();
        });

*/
        
        // orientation
        this._isPort = 'doit';
        this.inChange = false;
        this.reOrient(true);            // initial = true so dont do timers and dont call show
        
        // hook into window resize 
        Minx.eq.subscribe(this, window, 'resize', '_resizeEvent');

        Minx.eq.subscribe(this, window, 'orientationchange', '_resizeEvent');
        

    },


    showMain: function(how) {

        // if phone slide it into place - and show a new back button
        if (typeof how == "undefined") {
            how = "slide-left";
        }
        else if( how == "") {
            how = "slide-left";
        }
        
        this._navPanel.getContentPanel().setActivePanel(this._activeMain, how);
    },


    _resizeEvent: function(e) {
        if(!this.inChange) {
            this.inChange = true;
            Minx.pm.calcDims();
            this.reOrient(false);           // true ro draw it all
            this.inChange = false;
        }
    },


    reOrient: function(initial) {
        
        var nisPort = (Minx.pm.dims.or === 'p');
        console.log('or = ' + Minx.pm.dims.or);

        if(nisPort !== this._isPort){
            
            this._isPort = nisPort;
            if(nisPort) {
                this._setPortrait(initial);
            }
            else {
                this._setLandscape(initial);
            }
        }
    },


    setMainPanelContent: function(panel, how) {
        this._activeMain = panel;
        this._navPanel.getContentPanel().setActivePanel(panel, how)
    },


    // called when a navigation action has occured
    navAction: function() {
        // phone layout does nowt
    },

    getMainPanel: function() {
        return this._navPanel;
    },


    getNavPanel: function() {
        return this._navPanel;  
    },


    show: function() {
        
        console.log("Showing mainLayout navpanel: " + this._navPanel.getId());

        this._navPanel.show();
    },


    _setLandscape: function(initial) {
        var me = this;
        var nw = Minx.pm.dims.w;
        var nh = Minx.pm.dims.h;
        
        window.scrollTo(0, 0);
        
        this._navPanel.setSize(nw, nh);
        
        this._navPanel.render();        
    },


    _setPortrait: function(initial) {
        var me = this;

        // need to know current width to slide left that much
        var navp = this._navPanel.getDims();

        var nw = Minx.pm.dims.w;
        var nh = Minx.pm.dims.h;
        
        
        var startTime = undefined;
        var time = undefined;
        var startPos = 0;
        

        function render(time) {
          time = Date.now();
          // time difference in 10ths of secconds - divide by 10 - one second - divide by 2 (as below) = (10/2) 10ths of a second or half a second
          var npos = startPos - (time - startTime)/1.5;

          if(npos < 0) {
              npos = 0;
          }

          window.scrollTo(npos, 0);

          return npos > 0;
        }


        me._navPanel.setSize(nw, nh);

        this._navPanel.render();


            setTimeout(function() {
            //    window.scrollTo(0, 0);    
                startPos = window.scrollX;
                startTime = Date.now();
                
                (function animloop(){
                    if(render()) {
                      requestAnimFrame(animloop);
                    }
                })();

            }, 90);

    },

});