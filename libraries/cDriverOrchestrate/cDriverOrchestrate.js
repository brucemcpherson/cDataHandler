/** wrapper
 */
function createDriver (handler,siloId,driverSpecific,driverOb, accessToken,options) {
    return new DriverOrchestrate(handler,siloId,driverSpecific,driverOb, accessToken,options);
}
function getLibraryInfo () {
  return {
    info: {
      name:'cDriverOrchestrate',
      version:'2.0.1',
      key:'MFOtcXFHPAtxy_lb6tkhrXKi_d-phDA33',
      share:'https://script.google.com/d/1flLc9GTC-0sQKv09zKfmxi7Mb8s32W3tEbW7bj1gmv5hKQFm0FlOBVT6/edit?usp=sharing',
      description:'db abstraction driver for orchestrate.io'
    },
    dependencies:[
    ]
  }; 
}
/**
 * DriverOrchestrate
 * @param {cDataHandler} handler the datahandler thats calling me
 * @param {string} tableName this is the orchestrate collection
 * @param {string} id some id you create for identifying this collection
 * @param {object} orchestrateOb a orchestrateOb ob if required  ( { restAPIKey:"your orchestrate developer key"} )
 * @param {object} options what was sent to dbabstraction
 * @return {DriverOrchestrate} self
 */
 
var DriverOrchestrate = function (handler,tableName,id,orchestrateOb,accessToken,options) {
  var siloId = tableName;
  var dbId = id;
  var self = this;
  var parentHandler = handler;
  var enums = parentHandler.getEnums();  
  var handle = self;
  var keyOb = orchestrateOb;
  var handleError, handleCode; 
  var SLEEPAFTER = 1000;
  
  self.getType = function () {
    return enums.DB.ORCHESTRATE;
  };
  
  /** each saved records needs a unique key in orchestrate
   * @return {string} a unique key
   */
  self.generateKey = function () {
    return parentHandler.generateUniqueString();
  };
  self.getDbId = function () {
    return dbId;
  };
  
  /** no persistent handle for this rest query - just return self
   * @return {DriverOrchestrate} self
   */
  self.getDriveHandle =  function () {
    return handle;
  };

 /** create the url based on the parameters and the query and the key
  * @param {string} optKey this is the item key
  * @param {objects} params contains the query and any parameters
  * @return {string} the url
  */
  self.getUrl = function (optKey, params) {
    params = params || {};
    var u= "https://api.orchestrate.io/v0/" + 
      self.getTableName() + 
      (optKey ? "/" + optKey : "");
    
    var p = Object.keys(params).map(function(k) {
      return k+"="+encodeURIComponent(params[k]);
    }).join("&");

    return  u + (p.length ? "?" + p : "");
  }
  
/** create the urlfetch options 
 * @param {object} options any additional options to add
 * @return {object} the urlfetch options
 */
  
  self.getOptions = function (options) {
    var options = options || {};
    
    options.headers = {"Authorization": "Basic " + Utilities.base64Encode(keyOb.restAPIKey + ":")};
    options.contentType = "application/json" ;
    options.muteHttpExceptions = true;
    return options;
  }
  
 /** create the driver version
  * @return {string} the driver version
  */ 
  self.getVersion = function () {
    return 'DriverOrchestrate-v0.2';
  };
  
  /**
   * DriverOrchestrate.getTableName()
   * @return {string} table name or silo
   */
  self.getTableName = function () {
    return siloId;
  };

  function translateConstraints (queryOb) {
    // flatten query and preserve constraints
    var flat = queryOb ? parentHandler.flatten(queryOb, true) : {};

    return Object.keys(flat).reduce(function(p,c) {

      // this is the constraint object
      var con = flat[c];
            
      if( parentHandler.isObject(con) && con.hasOwnProperty(enums.SETTINGS.CONSTRAINT)) { 

        var ec = enums.CONSTRAINTS;;
        con[enums.SETTINGS.CONSTRAINT].forEach(function(d) {

          if (typeof d.value === 'number') {
            var rangeMin = enums.SETTINGS.MIN_NUMBER,rangeMax = enums.SETTINGS.MAX_NUMBER;
          }
          else {
            var rangeMin = enums.SETTINGS.MIN_STRING, rangeMax = enums.SETTINGS.MAX_STRING;
          }
          var v = parentHandler.makeQuote (d.value);
          if (d.constraint === ec.EQ) {
            p.push( c + ':' + v);
          } 
          else if (d.constraint === ec.NE) {
            p.push( 'NOT ' + c + ':' + v);
          }
          else if (d.constraint === ec.IN) {
            p.push ( doins(d,c) );
          }
          else if (d.constraint === ec.NIN) {
            p.push ( ' NOT ' + doins(d,c) );
          }
          else if (d.constraint === ec.LT) {
            p.push( '( ' + c + ':' + rangeMin  + ' OR ' + c + ':{'+ rangeMin +' TO ' + v + '} )');
          }
          else if (d.constraint === ec.GT) {
            p.push( '( ' + c + ':' + rangeMax  + ' OR ' + c + ':{' + v + ' TO '+ rangeMax +'} )');
          }
          else if (d.constraint === ec.LTE) {
            p.push( c + ':['+ rangeMin +' TO ' + v + ']');
          }
          else if (d.constraint === ec.GTE) {
            p.push(  c + ':[' + v + ' TO '+ rangeMax +']');
          }
          else {
            throw d.constraint + ' is an unknown constraint';
          }
        });
      }
      else {
        if (parentHandler.isObject(con)) {
          throw (JSON.stringify(con) + ' should have been flattened');
        }
        p.push( c + ':' + con);
      }
      return p;
    },[]).join(" AND ");
    
    function doins (d,c) {
      return '( ' + (Array.isArray(d.value) ? d.value : [d.value]).reduce(function(ip,ic) {
        ip.push(c + ':' + parentHandler.makeQuote(ic));
        return ip;
      },[]).join(" OR ") + ')' ;
    }
  
  }
  /**
   * DriverOrchestrate.makeQuery
   * @param {object} queryOb the query
   * @param {object} queryParams any parameters
   * @return {object} the params ready for url generation
   */
  function makeQuery (queryOb,queryParams) {
   var result = null,params;
   handleCode = enums.CODE.OK, handleError='';
    
    try {
      // make the query
      params ={query:translateConstraints(queryOb) || "*"};
      
      // and the parameters
      var paramResult = parentHandler.getQueryParams(queryParams);
      
      if (handleCode === enums.CODE.OK) {
        paramResult.data.forEach (function (p) {
          
          if (p.param === 'sort') {
            //return ' ORDER BY ' + p.sortKey + (p.sortDescending ?  ' DESC' : ' ASC') ;
          }
          else if (p.param === 'limit' ){
            params.limit = p.limit;
          }
          else if (p.param === 'skip' ) {
            params.offset =  p.skip;
          }
        });

      }        
    }
    catch(err) {
      handleError = err + "(query:" + JSON.stringify(params) + ")";
      handleCode =  enums.CODE.DRIVER;
    }
    Logger.log(params);
    return params;
  }
   /**
   * DriverOrchestrate.query()
   * @param {object} queryOb some query object 
   * @param {object} queryParams additional query parameters (if available)
   * @param {boolean} keepIds whether or not to keep driver specifc ids in the results
   * @return {object} results from selected handler
   */
  self.query = function (queryOb,queryParams,keepIds) {
    
    return parentHandler.readGuts ( 'query' , function() {
      
      var result =[],url='',driverIds =[], handleKeys=[];
      handleCode = enums.CODE.OK, handleError='';
      
      try {
        var params = makeQuery(queryOb,queryParams);
        var limit = params.limit || 0;
        var skip = params.offset || 0;
        var exhausted = false;
        // need to deal with limits applied to the API
        var options = self.getOptions({"method" : "GET"});
  
        while (handleCode === enums.CODE.OK && (result.length < limit || limit ===0) && !exhausted) {
          params.offset = skip + result.length;
          url = self.getUrl(undefined,params); 
          var chunk = self.execute (url, options);
          exhausted = !chunk || (chunk.results.length === 0 );
          if(!exhausted) {
            chunk.results.forEach (function(d){
              if (result.length < limit || limit ===0) {
                result.push(d);
              }
            });
          }
        }
      }
      catch(err) {
        handleError = err + "(query:" + url + ")";
        handleCode =  enums.CODE.DRIVER;
      }
      
      // fix up the result
      result = result.map(function(d) {
        if (keepIds) { 
          driverIds.push({path:d.path});
          handleKeys.push(d.path.key);
        }
        return d.value;
      });
  
      return parentHandler.makeResults (handleCode,handleError,result,keepIds ? driverIds :null,keepIds ? handleKeys:null);
    });
  };

   /**
   * DriverOrchestrate.remove()
   * @param {object} queryOb some query object 
   * @param {object} queryParams additional query parameters (if available)
   * @return {object} results from selected handler
   */
   
  
  self.remove = function (queryOb,queryParams) {
    
    return parentHandler.writeGuts ( 'remove' , function() {
      var result =null,url='';
      handleError='', handleCode=enums.CODE.OK;
      
      try {
        // start with a query
        var queryResults = self.query (queryOb, queryParams , true);
        
   
        if (handleCode === enums.CODE.OK) {
  
          // delete them all
          var options = self.getOptions({"method" : "DELETE"});
          
          if (queryResults.handleKeys) {
            result = queryResults.handleKeys.forEach(function(d) {
              url = self.getUrl(d,{force:true});
              return self.execute (url, options);
            });
          }
          // changes to orchestrate are not immediately visible to later queries.. so wait a bit befor going back
          Utilities.sleep(SLEEPAFTER);
        }
      }
      catch(err) {
        handleError = err + "(query:" + url + ")";
        handleCode =  enums.CODE.DRIVER;
      }
      
      return parentHandler.makeResults (handleCode,handleError,result);
    });
  };

  
  self.execute = function (url,options) {
    var result = parentHandler.rateLimitExpBackoff ( function () {

      var h = UrlFetchApp.fetch(url,options);

      if (h.getResponseCode() !== 201 && h.getResponseCode() !== 200 && h.getResponseCode() !== 204) {
        handleCode = enums.CODE.HTTP;
        handleError = h.getContentText() +"(http error code:" + h.getResponseCode()+ ")(url:" +url+")";
      }
      var t = h.getContentText();

      if (t) {
        var o = JSON.parse(t);
        if (o.message) {
          handleCode = enums.CODE.DRIVER;
          handleError = JSON.stringify(o.message);
          return null;
        }
        else { 
          return o;
        }
      }
      else {
        return null;
      }

    });

    return result;
  }
  /**
   * DriverOrchestrate.save()
   * @param {Array.object} obs array of objects to write
   * @return {object} results from selected handler
   */
  self.save = function (obs) {
    
    return parentHandler.writeGuts ( 'save' , function() {
      var result =null,url = '';
      handleError='', handleCode=enums.CODE.OK;
      
      try {
        var options = self.getOptions({"method" : "PUT"});
        result = obs.map (function(d) {
          url = self.getUrl(self.generateKey());
          options.payload =  JSON.stringify(d);
          return self.execute (url, options);
        });
        // changes to orchestrate are not immediately visible to later queries.. so wait a bit befor going back
          Utilities.sleep(SLEEPAFTER);
      }
      catch(err) {
        handleError = err + "(query:" + url + ")";
        handleCode =  enums.CODE.DRIVER;
      }
      
      return parentHandler.makeResults (handleCode,handleError,result);
    });
  };
 

  /**
   * DriverOrchestrate.count()
   * @param {object} queryOb some query object 
   * @param {object} queryParams additional query parameters (if available)
   * @return {object} results from selected handler
   */
  
  self.count = function (queryOb,queryParams) {
    
    return parentHandler.readGuts ( 'count' , function() {
      var result =[],url='';
      handleCode = enums.CODE.OK, handleError='';
  
      try {
        var options = self.getOptions({"method" : "GET"});
        var params = makeQuery(queryOb,queryParams);
        if (handleCode === enums.CODE.OK ) {
          url = self.getUrl(undefined,params); 
          var chunk = self.execute (url, options);
          result = [{count:chunk.total_count}];
        }
  
      }
      catch(err) {
        handleError = err + "(query:" + url + ")";
        handleCode =  enums.CODE.DRIVER;
      }
      
      return parentHandler.makeResults (handleCode,handleError,result);
    });
    
  };
  
    
  /**
   * Driver.get()
   * @param {string} key the unique return in handleKeys for this object
   * @param {boolean} keepIds whether or not to keep driver specifc ids in the results
   * @return {object} results from selected handler
   */
  self.get = function (key,keepIds) {
    return parentHandler.readGuts ( 'get' , function() {
      return getGuts_(key,keepIds);
    });
  };
  
  function getGuts_(keys) {
      var result,url;
      handleError='', handleCode=enums.CODE.OK;
      try {
      
        var options = self.getOptions({"method" : "GET"});

        result = (Array.isArray(keys) ? keys : [keys]).map(function(k) {
          url = self.getUrl (k);
          return self.execute( url, options);
        });

      }
      catch(err) {
        handleError = err + "(query:" + url + ")";
        handleCode =  enums.CODE.DRIVER;
      }
  
      return parentHandler.makeResults (handleCode,handleError,result);
  }
  /**
   * Driver.update()
   * @param {string} keys the unique return in handleKeys for this object
   * @param {object} ob what to update it to
   * @return {object} results from selected handler
   */

  self.update = function (keys,ob) {
  
    return parentHandler.writeGuts ( 'update' , function() {
        var result =null,url;

        handleError='', handleCode=enums.CODE.OK;
        try {
          if(!Array.isArray(ob)) ob = [ob];
          var options = self.getOptions({"method" : "PUT"});

          (Array.isArray(keys) ? keys : [keys]).forEach(function(k,i) {
            url = self.getUrl (k);
            options.payload =  JSON.stringify( ob[ob.length === 1 ? 0 : i] );
            result = self.execute( url, options);
          });

        }
        catch(err) {
          handleError = err + "(query:" + url + ")";
          handleCode =  enums.CODE.DRIVER;
        }
    
        // changes to orchestrate are not immediately visible to later queries.. so wait a bit befor going back
        Utilities.sleep(SLEEPAFTER);
        return parentHandler.makeResults (handleCode,handleError,result);
    });
  };
  
  return self;
  
}
