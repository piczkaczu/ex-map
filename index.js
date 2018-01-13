const fetchLocal = url =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      resolve(JSON.parse(xhr.responseText));
    };
    xhr.onerror = () => {
      reject(new TypeError("Local request failed"));
    };
    xhr.open("GET", url);
    xhr.send(null);
  });

const renderPopup = layer => {
  const feature = layer.feature;
  const dates = feature.properties.dates;
  let lngLat = feature.geometry.coordinates;
  lngLat = lngLat.map(x => Math.round(x * 1000000) / 1000000);

  let exraidHTML = "";
  if (dates && dates.length > 0) {
    exraidHTML += "<div>Wytypowany:<ul>";
    dates.forEach(date => {
      exraidHTML += "<li>" + moment(date).format("DD-MM") + "</li>";
    });
    exraidHTML += "</ul></div>";
  } else {
    exraidHTML += "<div>Nietypowany</div>";
  }

  return `
    <strong>
    ${feature.properties.name}
    </strong>
    ${exraidHTML}
    <div>S2 Cell: ${feature.properties.s2Cell}</div>
    <br/>
    <div>
      <a target="_blank" href="
      https://www.google.com/maps/search/?api=1&query=${lngLat[1]},${lngLat[0]}
      ">
        Google Maps
      </a>
    </div>
    <br/>
    <div>
      <a target="_blank" href="
      #${lngLat[1]},${lngLat[0]}
      ">
        
      </a>
    </div>
    `;
};

const markers = L.markerClusterGroup({
  maxClusterRadius: () => {
    return currentFilter === "raids" ? 0 : 80;
  },
  disableClusteringAtZoom: 1,
  spiderfyOnMaxZoom: false
});
const map = L.map("map", {
  center: [52.742, 15.243],
  zoom: 11,
  minZoom: 1
}).on("overlayadd", () => {
  $("#secondary-group > .active > input").trigger("change");
});
let gyms;
let s2latLngs;
let terrains = [];
let dates = [];
let currentFilter = "raids";
const s2LocationCountLayer = L.featureGroup();
const s2TotaRaidsLayer = L.featureGroup();
const s2PolygonLayer = L.geoJSON();
const s2LayerGroup = L.featureGroup([s2PolygonLayer]);
const s2CountsLayerGroup = L.featureGroup();
const s2TotalsLayerGroup = L.featureGroup();

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  // L.tileLayer("http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.facebook.com/groups/273877699635623/" target="_blank">Lokalna Grupa Facebook</a>'
}).addTo(map);

L.control.locate().addTo(map);

const addToMap = (filter = () => true) => {
  const s2CellCount = {};
  let onEachFeature = () => {};
  const isS2Toggled = map.hasLayer(s2LayerGroup);
  if (isS2Toggled) {
    onEachFeature = feature => {
      const total = feature.properties.dates.length;
      const s2Cell = s2CellCount[feature.properties.s2Cell];

      if (s2Cell) {
        s2CellCount[feature.properties.s2Cell] = {
          count: s2Cell.count + 1,
          total: s2Cell.total + total
        };
      } else {
        s2CellCount[feature.properties.s2Cell] = { count: 1, total };
      }
    };
  }

  const layer = L.geoJSON(gyms, {
    filter,
    pointToLayer: (geoJsonPoint, latLng) =>
      L.marker(latLng, {
        opacity: isS2Toggled ? 0.7 : 1
      }),
    onEachFeature
  });

  if (isS2Toggled) {
    overlayS2Labels(s2CellCount);
  }

  markers.clearLayers();
  markers
    .addLayer(layer)
    .bindPopup(renderPopup, { autoPanPaddingTopLeft: [100, 100] });
  map.addLayer(markers);
  return markers;
};

const overlayS2Labels = s2CellCount => {
  const s2Cells = L.featureGroup(
    s2latLngs.map(({ s2Cell, topleft }) =>
      L.marker(topleft, {
        icon: L.divIcon({
          className: "s2-label",
          html: s2CellCount[s2Cell] ? s2Cell : ""
        })
      })
    )
  );

  const counts = L.featureGroup(
    s2latLngs.map(({ s2Cell, topright }) =>
      L.marker(topright, {
        icon: L.divIcon({
          className: "s2-label s2-count",
          html: s2CellCount[s2Cell] ? s2CellCount[s2Cell].count : ""
        })
      })
    )
  );

  const totals = L.featureGroup(
    s2latLngs.map(({ s2Cell, bottomleft }) =>
      L.marker(bottomleft, {
        icon: L.divIcon({
          className: "s2-label s2-total",
          html: s2CellCount[s2Cell] ? s2CellCount[s2Cell].total : ""
        })
      })
    )
  );

  s2LayerGroup.clearLayers();
  s2CountsLayerGroup.clearLayers();
  s2TotalsLayerGroup.clearLayers();
  s2LayerGroup.addLayer(s2PolygonLayer);
  s2LayerGroup.addLayer(s2Cells);
  s2CountsLayerGroup.addLayer(counts);
  s2TotalsLayerGroup.addLayer(totals);
};

fetchLocal(
  https://rawgit.com/piczkaczu/3ea7e08161aaad618af5423dab59b9d2/raw/407dedd610f730d434d590be92d3bbc0082aa08e/all.geojson"
)
  .then(data => {
    gyms = data;

    terrains = [].concat(
      ...gyms.features.map(feature => feature.properties.terrains)
    );
    terrains = terrains
      .filter((item, pos) => item && terrains.indexOf(item) === pos)
      .sort((a, b) => moment(b) - moment(a));

    dates = [].concat(
      ...gyms.features.map(feature => feature.properties.dates)
    );
    dates = dates
      .filter((item, pos) => item && dates.indexOf(item) === pos)
      .sort((a, b) => moment(b) - moment(a));
    dates.reverse();

    // show submenu at start
    $('#primary-group [value="raids"]').trigger("change");

    return Promise.resolve();
  })
  .then(() =>
    fetchLocal(
      "https://rawgit.com/piczkaczu/725d2c81405587f87c2b218cba31b25e/raw/76b3db73464278142f34bbfc2fe9d5c8e4c03c72/S2.geojson"
    )
  )
  .then(data => {
    s2latLngs = data.features.map(feature => ({
      topleft: [feature.coordinates[0][3][1], feature.coordinates[0][3][0]],
      topright: [feature.coordinates[0][2][1], feature.coordinates[0][2][0]],
      bottomright: [feature.coordinates[0][1][1], feature.coordinates[0][1][0]],
      bottomleft: [feature.coordinates[0][0][1], feature.coordinates[0][0][0]],
      s2Cell: feature.properties.order
    }));
    s2PolygonLayer.addData(data);

    L.control
      .layers(null, {
        "Strefy S2": s2LayerGroup,
        "Liczba Gymow w strefie": s2CountsLayerGroup,
      })
      .addTo(map);
  });

$("#primary-group").on("change", 'input[type="radio"]', e => {
  currentFilter = e.target.value;
  $("#secondary-group").empty();
  let defaultButton;
  let key;
  switch (e.target.value) {
    case "raids":
      key = "dates";
      defaultButton = dates[dates.length - 1];

      dates.forEach(date => {
        $("#secondary-group").prepend(`
          <label class="btn btn-secondary" for="${date}">
            <input type="radio" name="${key}" id="${date}" value="${date}">
            ${moment(date).format("DD-MM")}
          </label>
        `);
      });

      // default
      $("#secondary-group").prepend(`
//        <label class="btn btn-secondary" for="all">
//          <input type="radio" name="${key}" id="all" value="all" checked>
//          Wszystkie
//        </label>
      `);
      break;
    case "all":
      addToMap();
      break;
    case "parks":
      key = "terrains";
      defaultButton = "2017-01-07";
      addToMap(
        feature =>
          feature.properties[key] &&
          feature.properties[key].indexOf(defaultButton) > -1
      );

      // default
      $("#secondary-group").append(`
//        <label class="btn btn-light" disabled>
//          Wykluczone na tydzien od:
//        </label>
      `);

      terrains.forEach(terrain => {
        $("#secondary-group").append(`
          <label class="btn btn-secondary" for="${terrain}">
            <input type="radio" name="${key}" id="${terrain}" value="${terrain}"
              ${terrain === defaultButton ? "checked" : ""}>
            ${moment(terrain).format("DD-MM")}
          </label>
        `);
      });
      break;
  }
  $('#secondary-group input[type="radio"]').button();
  $(`#secondary-group label[for="${defaultButton}"]`).button("toggle");
});

$("#secondary-group").on("change", 'input[type="radio"]', function(e) {
  const key = $(this).prop("name");
  if (e.target.value === "all") {
    addToMap(
      feature => feature.properties[key] && feature.properties[key].length > 0
    );
  } else {
    addToMap(
      feature =>
        feature.properties[key] &&
        feature.properties[key].indexOf(e.target.value) > -1
    );
  }
});
