const express = require('express');
const exphbs  = require('express-handlebars');

const app = express();

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.use('/api', require('./api'));

app.listen(3000, function () {
  console.log('App listening on port 3000!');
});
