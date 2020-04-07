const Helpers={};
Helpers.validateParams = function(params) {
    for(let i=0; i<params.length;i++)
    {
        if( params[i]==null || typeof params[i] == 'undefined' )
        {
            return false;
        }

    }
    return true;
};
Helpers.validateParamWithLength = function(params, maxLen = 140, checkForZeroLength = true) {
    for(let i=0; i<params.length;i++) {
        if( params[i]==null || typeof params[i] == 'undefined' || params[i].length > maxLen) {
            return false;
        }
        if(checkForZeroLength && params[i].toString().trim().length === 0)
            return false;
    }
    return true;
};

Helpers.handleName = function(input) {
    let n=input.indexOf(" ");
    n += input.indexOf(",");
    let result = {};
    if(n < 0){
        result.first = input;
        result.last = "";
    }
    else{
        let arr =  input.split(/[ ,]+/);
        result.first = arr[0];
        result.last = "";
        if(arr.length > 1)
        {
            arr.splice(0,1);
            result.last = arr.join(" ");

        }
    }

    return result;
};

Helpers.isObject = function(obj) {
    return obj !== undefined && obj !== null && obj.constructor === Object;
};

Helpers.isInteger = function(n) {
    try {
        if(isNaN(parseInt(n)))
            return false;
    }catch(_) {
        return false;
    }
    return true;
};

Helpers.isFloat = function(n) {
    try {
        if(isNaN(parseFloat(n)))
            return false;
    }catch(_) {
        return false;
    }
    return true;
};

Helpers.currentTimeInSeconds = function() {
    return Math.floor(Date.now()/1000);
};

Helpers.base64toHEX = function(base64) {
    return (new Buffer(base64, 'base64').toString('hex'));
};

module.exports=Helpers;
