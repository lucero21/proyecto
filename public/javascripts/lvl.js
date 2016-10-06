/*** Created by lucero on 03/10/2016.*/
var refresh_score = function(){
    $.get('me')


        .done(function (data) {
            //console.log(data);
              //$("#score").empty();
             $('#score').html(" "+data.score);

        });
}

var interval = 2000; // where X is your every X minutes

setInterval(refresh_score, interval);