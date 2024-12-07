// Advanced Flood Risk Assessment with Improved Calibration

// Configuration Object with More Precise Parameters
var CONFIG = {
	STUDY_AREA: {
    	BOUNDS: [8, 30, 12, 38],
    	CRS: 'EPSG:4326'
	},
	DATE_RANGE: {
    	START: '2020-01-01',
    	END: '2024-01-01'
	},
	SCALE: {
    	ANALYSIS: 1000,
    	EXPORT: 30
	},
	RISK_CALIBRATION: {
    	PRECIPITATION_WEIGHT: 0.25,
    	ELEVATION_WEIGHT: -0.2,
    	FLOW_ACCUMULATION_WEIGHT: 0.25,
    	SLOPE_WEIGHT: -0.15,
    	SOIL_WEIGHT: 0.35,
    	RISK_THRESHOLDS: {
        	LOW: 0.2,
        	MODERATE: 0.4,
        	HIGH: 0.6,
        	VERY_HIGH: 0.8
    	}
	}
};

// Advanced Normalization with Percentile-based Scaling
// Advanced Normalization with Percentile-based Scaling
function percentileNormalization(image) {
	var percentiles = image.reduceRegion({
    	reducer: ee.Reducer.percentile([5, 25, 50, 75, 95]),
    	geometry: image.geometry(),
    	scale: CONFIG.SCALE.ANALYSIS,
    	maxPixels: 1e9
	});
	var p5 = ee.Number(percentiles.values().get(0));
	var p95 = ee.Number(percentiles.values().get(4));
	return image.expression(
    	'max(0, min(1, (x - min) / (max - min + 1e-10)))', {
        	'x': image,
        	'min': p5,
        	'max': p95
    	}
	);
}

// Weighted Risk Calculation with Advanced Logic
function calculateFloodRisk(precipitationNorm, elevationNorm, flowAccumulationNorm, slopeNorm, soilNorm) {
	var riskIndex = precipitationNorm
    	.multiply(CONFIG.RISK_CALIBRATION.PRECIPITATION_WEIGHT)
    	.add(elevationNorm.multiply(CONFIG.RISK_CALIBRATION.ELEVATION_WEIGHT))
    	.add(flowAccumulationNorm.multiply(CONFIG.RISK_CALIBRATION.FLOW_ACCUMULATION_WEIGHT))
    	.add(slopeNorm.multiply(CONFIG.RISK_CALIBRATION.SLOPE_WEIGHT))
    	.add(soilNorm.multiply(CONFIG.RISK_CALIBRATION.SOIL_WEIGHT))
    	.add(1)
    	.multiply(0.5);
	return riskIndex;
}

// Comprehensive Flood Risk Analysis Function
function performFloodRiskAnalysis() {
	var tunisia = ee.Geometry.Rectangle({
    	coords: CONFIG.STUDY_AREA.BOUNDS,
    	proj: CONFIG.STUDY_AREA.CRS,
    	geodesic: false
	});
	print('Study Area Geometry:', tunisia); // Debugging

	var precipitationCollection = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    	.filter(ee.Filter.date(CONFIG.DATE_RANGE.START, CONFIG.DATE_RANGE.END))
    	.filter(ee.Filter.bounds(tunisia));
	print('Precipitation Collection Size:', precipitationCollection.size()); // Debugging

	var annualPrecipitation = precipitationCollection
    	.reduce(ee.Reducer.sum())
    	.clip(tunisia)
    	.rename('annual_precipitation');
	print('Annual Precipitation:', annualPrecipitation); // Debugging

	var elevation = ee.Image('USGS/SRTMGL1_003')
    	.select('elevation')
    	.clip(tunisia)
    	.rename('elevation');
	print('Elevation Image:', elevation); // Debugging

	var flowAccumulation = ee.Image('MERIT/Hydro/v1_0_1')
    	.select('upa')
    	.clip(tunisia)
    	.rename('flow_accumulation');
	print('Flow Accumulation Image:', flowAccumulation); // Debugging

	var slope = ee.Terrain.slope(elevation).rename('slope');
	print('Slope Image:', slope); // Debugging

	// Add Soil Data
	var soil = ee.Image('OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02')
    	.select('b0')
    	.clip(tunisia)
    	.rename('soil_texture');
	print('Soil Texture Data:', soil); // Debugging

	var normalizedPrecipitation = percentileNormalization(annualPrecipitation);
	var normalizedElevation = percentileNormalization(elevation);
	var normalizedFlowAccumulation = percentileNormalization(flowAccumulation);
	var normalizedSlope = percentileNormalization(slope);
	var normalizedSoil = percentileNormalization(soil);

	var floodRiskIndex = calculateFloodRisk(
    	normalizedPrecipitation,
    	normalizedElevation,
    	normalizedFlowAccumulation,
    	normalizedSlope,
    	normalizedSoil
	).rename('flood_risk');
	print('Flood Risk Index:', floodRiskIndex); // Debugging

	var highRiskAreas = floodRiskIndex.gt(CONFIG.RISK_CALIBRATION.RISK_THRESHOLDS.HIGH)
    	.rename('high_risk_areas');
	print('High Risk Areas:', highRiskAreas); // Debugging

	return {
    	annualPrecipitation: annualPrecipitation,
    	floodRiskIndex: floodRiskIndex,
    	highRiskAreas: highRiskAreas,
    	soilTexture: soil
	};
}

// Visualization Configuration
function configureAdvancedVisualization(analysisResults) {
	var floodRiskVis = {
    	min: 0,
    	max: 1,
    	palette: ['#2ecc71', '#f39c12', '#e74c3c', '#9b59b6']
	};

	Map.setOptions('SATELLITE'); // Optional: Set map base layer
	Map.centerObject(ee.Geometry.Rectangle(CONFIG.STUDY_AREA.BOUNDS), 7);
	Map.addLayer(analysisResults.annualPrecipitation,
    	{min: 0, max: 2000, palette: ['blue', 'yellow', 'red']},
    	'Annual Precipitation');
	Map.addLayer(analysisResults.floodRiskIndex,
    	floodRiskVis,
    	'Flood Risk Index');
	Map.addLayer(analysisResults.highRiskAreas.updateMask(analysisResults.highRiskAreas),
    	{palette: '#e74c3c'}, 'High Flood Risk Zones');
	Map.addLayer(analysisResults.soilTexture,
    	{min: 0, max: 10, palette: ['#fef0d9', '#fdcc8a', '#fc8d59', '#d7301f',
                                	'#91cf60', '#1a9850', '#3288bd', '#5e4fa2']},
    	'Soil Texture');
}

// Main Execution
function main() {
	try {
    	var analysisResults = performFloodRiskAnalysis();
    	configureAdvancedVisualization(analysisResults);
    	Export.image.toDrive({
        	image: ee.Image([
            	analysisResults.annualPrecipitation,
            	analysisResults.floodRiskIndex,
            	analysisResults.highRiskAreas.toFloat(),
            	analysisResults.soilTexture
        	]),
        	description: 'Tunisia_Refined_Flood_Risk_Analysis',
        	scale: CONFIG.SCALE.EXPORT,
        	region: ee.Geometry.Rectangle(CONFIG.STUDY_AREA.BOUNDS),
        	maxPixels: 1e9
    	});
	} catch (e) {
    	print('Analysis Execution Error:', e);
	}
}

// Execute the Analysis
main();


