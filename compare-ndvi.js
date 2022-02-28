// CDL
var cropLandcover = cdl
  .filter(ee.Filter.date('2018-01-01', '2019-12-31'))
  .first()
  .select('cropland');
  
var isApple = cropLandcover.eq(68);

var appleCDL = cropLandcover.updateMask(isApple);

// To give each image bands representing independent variables,
// map a function over the collection
var timeField = 'system:time_start';

// CLEAN CLOUDS ----------------------------------------------------------

// Function to cloud mask from the pixel_qa band of Landsat 8 SR data.
// (From the Code Editor Examples > Cloud Masking)

// LANDSAT
function maskL8sr(image) {
  // Bits 3 and 5 are cloud shadow and cloud, respectively.
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  // Get the pixel QA band.
  var qa = image.select('QA_PIXEL');
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
      .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  // Return the masked image, scaled to reflectance, without the QA bands.
  return image.updateMask(mask).divide(10000)
      .select('B[0-9]*')
      .copyProperties(image, ['system:time_start']);
}

// MODIS
// A function to mask out pixels that did not have observations.
var maskEmptyPixels = function(image) {
  // Find pixels that had observations.
  var withObs = image.select('num_observations_1km').gt(0)
  return image.updateMask(withObs)
}

// A function to mask out cloudy pixels.
var maskClouds = function(image) {
  // Select the QA band.
  var QA = image.select('state_1km')
  // Make a mask to get bit 10, the internal_cloud_algorithm_flag bit.
  var bitMask = 1 << 10;
  // Return an image masking out cloudy areas.
  return image.updateMask(QA.bitwiseAnd(bitMask).eq(0))
}

// Add variables for model fitting
// 
var addVariables = function(image) {
  var date = ee.Date(image.get(timeField)); // general way to get the date
  var years = date.difference(ee.Date('1970-01-01'), 'year'); // computing the time in years units of unix/epic time
  return image
    .addBands(ee.Image(years).rename('t').float()) // cast years to t 
    .addBands(ee.Image.constant(1)); // eq to add columns of 1 in the design matrix, a feature where every pixel equals to 1
};

var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['N', 'R']).rename('NDVI');
  return image.addBands(ndvi);
};

var renameBandModis = function(image){
  return image.select(['sur_refl_b01', 'sur_refl_b02'])
  .rename(['R', 'N']);
}

var renameBandLands = function(image){
  return image.select(['B4', 'B5'])
  .rename(['R', 'N']);
}

// Apply function and filter ---------------------------------------------

// Modis
var modis1 = modisQARaw.filterDate('2017-01-01', '2020-12-30')
  .map(maskEmptyPixels)
  .map(maskClouds);

var modis = modis1.combine(modisRaw)
  .map(renameBandModis)
  .map(addNDVI)
  .map(addVariables);

// Landsat
var l8 = l8Raw.filterDate('2017-01-01', '2020-12-30')
  .map(maskL8sr)
  .map(renameBandLands)
  .map(addNDVI)
  .map(addVariables);
  
// var planet = planetRaw.filterDate('2019-01-01', '2020-12-30')
//   .map(addNDVI)
//   .map(addVariables);

// Compute the betas using linear regresion reducer ----------------------
var independents = ee.List(['constant', 't']);
var dependent = ee.String('NDVI');

var trendModis = modis.select(independents.add(dependent)) // append ndvi to the end // expects the bands to be in order of independent followed by dependent
  .reduce(ee.Reducer.linearRegression(independents.length(), 1)); // # of independent variables is the size of list (length) and # of dependent is 1

var trendLands = l8.select(independents.add(dependent)) // append ndvi to the end // expects the bands to be in order of independent followed by dependent
  .reduce(ee.Reducer.linearRegression(independents.length(), 1)); // # of independent variables is the size of list (length) and # of dependent is 1

// var trendPlanet = planet.select(independents.add(dependent)) // append ndvi to the end // expects the bands to be in order of independent followed by dependent
//   .reduce(ee.Reducer.linearRegression(independents.length(), 1)); // # of independent variables is the size of list (length) and # of dependent is 1


// Plot a time series of NDVI at a single location.
var l8Chart = ui.Chart.image.series(l8.select('NDVI'), roi)
    .setChartType('ScatterChart')
    .setOptions({
      title: 'Landsat 8 NDVI time series at ROI',
      trendlines: {0: {
        color: 'CC0000'
      }},
      lineWidth: 1,
      pointSize: 3,
    });
print(l8Chart);

// Plot a time series of NDVI at a single location.
var ModisChart = ui.Chart.image.series(modis.select('NDVI'), roi)
    .setChartType('ScatterChart')
    .setOptions({
      title: 'Modis  NDVI time series at ROI',
      trendlines: {0: {
        color: 'CC0000'
      }},
      lineWidth: 1,
      pointSize: 3,
    });
print(ModisChart);

// Plot a time series of NDVI at a single location.
// var PlanetChart = ui.Chart.image.series(planet.select('NDVI'), roi)
//     .setChartType('ScatterChart')
//     .setOptions({
//       title: 'Planet NDVI time series at ROI',
//       trendlines: {0: {
//         color: 'CC0000'
//       }},
//       lineWidth: 1,
//       pointSize: 3,
//     });
// //print(PlanetChart);

// print(planet)
// print(trendPlanet)


var ndviParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};

var modisMean = modis.filterDate('2020-06-01', '2020-06-30')
  .select('NDVI')
  .reduce(ee.Reducer.mean())
  .mask(appleCDL);

var landsMean = l8.filterDate('2020-06-01', '2020-06-30')
  .select('NDVI')
  .reduce(ee.Reducer.mean())
  .mask(appleCDL);



Map.addLayer(modisMean, ndviParams, 'Modis')
Map.addLayer(landsMean, ndviParams, 'Landsat')
// Map.addLayer(l8.filterBounds(roi).select('NDVI'), ndviParams)
// Map.addLayer(modis.filterBounds(roi).select('NDVI'), ndviParams)
//Map.addLayer(appleCDL, {}, 'Crop Landcover');