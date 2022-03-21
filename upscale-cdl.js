var stateFips = ["42"] //, "34", "51", "20"];

// find the countries in the country list
var counties = cnty.filter(ee.Filter.inList('STATEFP', stateFips));
Map.addLayer(counties)
// CDL
var cropLandcover = cdl
  .filter(ee.Filter.date('2007-01-01', '2007-12-31'))
  .first()
  .select('cropland');
  
var isApple = cropLandcover.eq(68);
var appleCDL = cropLandcover.updateMask(isApple);

// Clean clouds
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

var renameBandModis = function(image){
  return image.select(['sur_refl_b01', 'sur_refl_b02'])
  .rename(['R', 'N']);
}

// Calculate NDVI
var addNDVI = function(image) {
  var ndvi = image.normalizedDifference(['N', 'R']).rename('NDVI');
  return image.addBands(ndvi);
};

// Modis
var modis1 = modisGA.filterDate('2007-01-01', '2007-12-30')
  .map(maskEmptyPixels)
  .map(maskClouds);
  
var modis = modis1.combine(modisRaw)
  .map(renameBandModis)
  .map(addNDVI);

var modisMean = modis.filterDate('2007-06-01', '2007-06-30')
  .select('NDVI')
  .reduce(ee.Reducer.median())
  //.clip(geometry)
  .reproject({
    crs:modisRaw.first().projection(),
    scale: modisRaw.first().projection().nominalScale()
  });

  // var modisJune = modis
  // .filterDate(year+'-01-01', year+'-12-31')
  // .filter(ee.Filter.calendarRange(5, 6, 'month'))
  // .map(addVariables)
  // .reduce(ee.Reducer.mean())
  // .reproject({
  //   crs:modisGQ.first().projection(),
  //   scale: modisGQ.first().projection().nominalScale()
  // });

print('Scale', ee.Image(modisRaw.first()).projection().nominalScale());

// Get CDL data at MODIS scale and projection
var modisProjection = modisMean.projection()
print('MODIS projection', modisProjection)
print('MODIS nominal scale', modisProjection.nominalScale())

var appleProjection = appleCDL.projection()//.atScale(250)
print('Apple nominal scale', appleProjection.nominalScale())

// Compute forest area per MODIS pixel.
var appleArea = appleCDL//.clip(geometry)
    // Force the next reprojection to aggregate instead of resampling.
    .reduceResolution({
      reducer: ee.Reducer.sum(),
      maxPixels: 1024
    })
    // The reduce resolution returns the fraction of the MODIS pixel
    // that's covered by 30 meter forest pixels.  Convert to area
    // after the reduceResolution() call.
    //.multiply(ee.Image.pixelArea())
    //Request the data at the scale and projection of the MODIS image.
    .reproject({
      crs: modisProjection,
      scale: modisProjection.nominalScale()
    });

// var areaPercentage = appleArea.select('cropland').divide(ee.Image.pixelArea())

// var appleArea = appleArea
//   .addBands(areaPercentage)
//   .rename(['areaApple', 'areaPercentage']);

var appleMODIS = appleArea
  .addBands(modisMean.mask(appleArea.select('cropland')).select('NDVI_median'))
  .rename(['areaPercentage', 'NDVI']);






//var modisMean = modisMean.mask(appleArea.select('areaPercentage'))
// Map
var ndviParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};

var vis = {min:0, max: 1, palette: ['white', 'red']};

var nSteps = 10
// Creates a color bar thumbnail image for use in legend from the given color palette
function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, nSteps, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: nSteps,
    palette: palette,
  };
}

// Create the colour bar for the legend
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0).int(),
  params: makeColorBarParams(vis.palette),
  style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
});
// Create a panel with three numbers for the legend
var legendLabels = ui.Panel({
  widgets: [
    ui.Label(vis.min, {margin: '4px 8px'}),
    ui.Label(
        ((vis.max-vis.min) / 2+vis.min),
        {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
    ui.Label(vis.max, {margin: '4px 8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
});

// Legend title
var legendTitle = ui.Label({
  value: 'Apple area (%)',
  style: {fontWeight: 'bold'}
});

// Add the legendPanel to the map
var legendPanel = ui.Panel([legendTitle, colorBar, legendLabels]);

// Map.addLayer(appleMODIS.select('NDVI'), ndviParams, 'NDVI');
// Map.addLayer(appleCDL, {}, 'Apples');
// Map.addLayer(appleMODIS.select('areaPercentage').gt(0.05), {min:0, max: 1, palette: ['white', 'red']}, 'Apple area %');
// Map.add(legendPanel);
// print('Apple area', appleMODIS);
// print('Apple MODIS scale', appleArea.projection().nominalScale());

//Export.image.toDrive({image: appleMODIS.select('areaPercentage').toDouble()})

// // export apple percent area
// Export.image.toDrive({
//   image: appleMODIS.select('areaPercentage').toDouble(),
//   description: 'apple_area_percentage_PA',
//   folder: 'reg_2007',
//   fileNamePrefix: 'apple_area_percentage_PA',
//   region: PA,
//   scale: 250
// });

// Export.image.toDrive({
//   image: appleMODIS.select('areaPercentage').toDouble(),
//   description: 'apple_area_percentage_VA',
//   folder: 'reg_2007',
//   fileNamePrefix: 'apple_area_percentage_VA',
//   region: VA,
//   scale: 250
// });

// Export.image.toDrive({
//   image: appleMODIS.select('areaPercentage').toDouble(),
//   description: 'apple_area_percentage_NJ',
//   folder: 'reg_2007',
//   fileNamePrefix: 'apple_area_percentage_NJ',
//   region: NJ,
//   scale: 250
// });

// Export.image.toDrive({
//   image: appleMODIS.select('areaPercentage').toDouble(),
//   description: 'apple_area_percentage_KS',
//   folder: 'reg_2007',
//   fileNamePrefix: 'apple_area_percentage_KS',
//   region: KS,
//   scale: 250
// });

// // export NDVI
// Export.image.toDrive({
//   image: appleMODIS.select('NDVI').toDouble(),
//   description: 'NDVI_PA',
//   folder: 'reg_2007',
//   fileNamePrefix: 'NDVI_PA',
//   region: PA,
//   scale: 250
// });

// Export.image.toDrive({
//   image: appleMODIS.select('NDVI').toDouble(),
//   description: 'NDVI_VA',
//   folder: 'reg_2007',
//   fileNamePrefix: 'NDVI_VA',
//   region: VA,
//   scale: 250
// });

// Export.image.toDrive({
//   image: appleMODIS.select('NDVI').toDouble(),
//   description: 'NDVI_NJ',
//   folder: 'reg_2007',
//   fileNamePrefix: 'NDVI_NJ',
//   region: NJ,
//   scale: 250
// });

// Export.image.toDrive({
//   image: appleMODIS.select('NDVI').toDouble(),
//   description: 'NDVI_KS',
//   folder: 'reg_2007',
//   fileNamePrefix: 'NDVI_KS',
//   region: KS,
//   scale: 250
// });