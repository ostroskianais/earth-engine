// credit https://gis.stackexchange.com/questions/356963/count-number-of-pixel-for-each-polygon-and-have-the-data-in-one-featurecollectio

var dataset = ee.ImageCollection('USDA/NASS/CDL')
                  .filter(ee.Filter.date('2014-01-01', '2014-12-31'))
                  .first();
                  
var cropLandcover = dataset.select('cropland');
var isApple = cropLandcover.eq(68);

var stateFips = ["42"];//, "34", "51", "20"];
var counties = cnty.filter(ee.Filter.inList('STATEFP', stateFips));

//Map.addLayer(counties)

var appleCDL = cropLandcover.updateMask(isApple);

//Map.setCenter(-100.55, 40.71, 4);
//Map.addLayer(appleCDL, {}, 'Crop Landcover');

// Count number of pixels

// var appleCDL = appleCDL
//   .addBands(ee.Image.constant(1)).rename(['cropland','constant'])
  
var raster = appleCDL
var featureCollection = counties;

var classifications = [ 
  {className: 'apples', classValue: 1, image: raster.eq(68)},
]

// Dictionary mapping classValue to className
var classNameByValue = classifications.reduce(
  function (acc, classification) {
    return acc.set('' + classification.classValue, classification.className)
  }, 
  ee.Dictionary()
);

// Single band classification, where the value of the band is the classValue
var classification = classifications
  .reduce(
    function (acc, classification) {
      return acc.add(
        classification.image.multiply(classification.classValue)
      )
    }, 
    ee.Image(0)
  );

// Dictionary mapping className to 0
var zeroByClassName = classifications.reduce(
  function (acc, classification) {
    return acc.set(classification.className, 0)
  },
  ee.Dictionary()
);

// The final counts features, with count by className
var counts = classification
  .addBands(classification)
  .reduceRegions({
    collection: featureCollection,
    reducer: ee.Reducer.count()
     // Groups the count by classValue
      .group({groupName: 'classValue'}),
    scale: 30,    
  })  
  .map(function (feature) {
    var groups = ee.List(feature.get('groups'))
    var properties = groups.iterate(
      function (group, acc) {
        group = ee.Dictionary(group)
        acc = ee.Dictionary(acc)
        var classValue = group.get('classValue')
        var className = classNameByValue.get(classValue)
        var count = group.get('count')
        return acc.set(className, count)
      },
      // Make sure we get all classNames, if they are in the geometry or not.
      zeroByClassName 
    )
    return ee.Feature(feature.geometry(), properties)
  });

//Map.addLayer(classification, {min: 1, max: classifications.length, palette: 'blue,green,yellow,red'})
//print('counts', counts)

Export.table.toDrive({
  collection: counts,
  description: "pixelCounts_PA_2014",
  folder: "cdl-areas",
  fileNamePrefix: "pixelCounts_PA_2014"
  });

