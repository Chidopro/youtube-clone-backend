export const API_KEY = "AIzaSyDM253bIPa1nEJnoqYfYLJ2Y7RrBUZ-Ejg";   

export const value_converter = (value) => {
    if(value>=1000000)
    {
        return Math.floor(value/1000000)+"M";
    }
    else if(value>=1000)
    {
        return Math.floor(value/1000)+"K";
    }
    else
    {
        return value;
    }
}