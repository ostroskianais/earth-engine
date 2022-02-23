// CDL
var dataset = ee.ImageCollection('USDA/NASS/CDL')
                  .filter(ee.Filter.date('2018-01-01', '2019-12-31'))
                  .first();
                  
var cropLandcover = dataset.select('cropland');
var isApple = cropLandcover.eq(68);

var appleCDL = cropLandcover.updateMask(isApple);

// Time
var timeField = 'system:time_start';

var addVariables = function(image) {
  var date = ee.Date(image.get(timeField)); // general way to get the date
  var years = date.difference(ee.Date('1970-01-01'), 'year'); // computing the time in years units of unix/epic time
  return image
    .addBands(ee.Image(years).rename('t').float()) // cast years to t 
    .addBands(ee.Image.constant(1)); // eq to add columns of 1 in the design matrix, a feature where every pixel equals to 1
};

var filteredPrism = prism
  .filterBounds(geometry)
  .map(addVariables)
  .filter(ee.Filter.date('2007-01-01', '2020-12-31'))
  
var precipitation = filteredPrism.select(['ppt','t', 'constant'])
  .filterBounds(geometry)
  .filter(ee.Filter.date('2007-01-01', '2020-12-31'))

// Plot a time series of mean temperature at a single location.
var tChart = ui.Chart.image.series(
  precipitation.select('ppt'), roi2)
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Monthly precipitation at ROI',
    trendlines: {0: {
      color: 'red'
  }},
  lineWidth: 1,
  pointSize: 3,
  });
print(tChart)

// Compute the betas using linear regresion reducer
var independents = ee.List(['constant', 't']);
var dependent = ee.String('ppt');

// Compute a linear trend, two bands: residuals and coefficients
var trend = precipitation.select(independents.add(dependent))
  .reduce(ee.Reducer.linearRegression(independents.length(), 1));

// //Map.addLayer(trend, {}, 'trend array image');

// Flatten the coefficients into a 2-band image
// Instead of having one vector for each pixel, generate image with bands
var coefficients = trend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([independents]);

// Compute de-trended series
var detrended = precipitation.map(function(image){
  return image.select(dependent).subtract(
    image.select(independents).multiply(coefficients).reduce('sum'))
    .rename(dependent)
    .copyProperties(image, [timeField])
})

// Plot detrended chart
var detrendedChart = ui.Chart.image.series(
  detrended, roi2, null, 30)
  .setOptions({
    title: 'Detrended mean precipitation time series at ROI',
    lineWidth: 1,
    pointSize: 3,
  });
print(detrendedChart)

// Estimate seasonality

// Use these independent variables in the harmonic regression.
var harmonicIndependents = ee.List(['constant', 't', 'cos', 'sin']);

// Add harmonic terms as new image bands.
var harmonicPPT = precipitation.map(function(image) {
  var timeRadians = image.select('t').multiply(2 * Math.PI);
  return image
    .addBands(timeRadians.cos().rename('cos'))
    .addBands(timeRadians.sin().rename('sin'));
});

var harmonicTrend = harmonicPPT
  .select(harmonicIndependents.add(dependent))
  // The output of this reducer is a 4x1 array image.
  .reduce(ee.Reducer.linearRegression({
    numX: harmonicIndependents.length(), 
    numY: 1
  }));

// Turn the array image into a multi-band image of coefficients.
var harmonicTrendCoefficients = harmonicTrend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([harmonicIndependents]);

// Compute fitted values.
var fittedHarmonic = harmonicPPT.map(function(image) {
  return image.addBands(
    image.select(harmonicIndependents)
      .multiply(harmonicTrendCoefficients)
      .reduce('sum')
      .rename('fitted'));
});

// Plot the fitted model and the original data at the ROI.
print(ui.Chart.image.series(
fittedHarmonic.select(['ppt','fitted']), roi2, ee.Reducer.mean(), 30)
    .setSeriesNames(['fitted', 'ppt'])
    .setOptions({
      title: 'Harmonic model: original and fitted values',
      lineWidth: 1,
      pointSize: 3,
      colors: ['9e3c3e','3f6eba']
}));

// // Compute phase and amplitude.
// var phase = harmonicTrendCoefficients.select('cos').atan2(
//             harmonicTrendCoefficients.select('sin'));

    
// var amplitude = harmonicTrendCoefficients.select('cos').hypot(
//                 harmonicTrendCoefficients.select('sin'));


// // Compute the mean NDVI.
// var meanTemp= temperature.select('tmean').mean();

// var rgb = phase.unitScale(-Math.PI, Math.PI).addBands( // hue
//           amplitude.multiply(2.5)).addBands( // saturation
//           ee.Image(1)).hsvToRgb(); // value

// Map.addLayer(rgb.clip(geometry), {}, 'phase (hue), amplitude (saturation)');
 Map.addLayer(appleCDL, {color: 'black'}, 'Crop Landcover');

