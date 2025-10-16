module.exports = function () {
    const date = new Date;
    const timestamp = `${(`0${  date.getMonth() + 1}`).slice(-2)  }/${ 
        (`0${  date.getDate()}`).slice(-2)  } ${ 
        (`0${  date.getHours()}`).slice(-2)  }:${ 
        (`0${  date.getMinutes()}`).slice(-2)  }:${ 
        (`0${  date.getSeconds()}`).slice(-2)}`;
    return timestamp;
};
