(function ($, L) {
  function screenSize () {
    return $(window).width() > 400 ? 'large' : 'small'
  }

  var map = new L.Map('map')

  function userLocator (map, s) {
    var settings = s || {
      setView: true,
      maxZoom: 17
    }
    var component = {}
    var button
    var circle

    function onLocationFound (e) {
      console.log(e)
      if (circle === undefined) {
        circle = L.circle(e.latlng, 200).addTo(map)
      } else {
        circle.setLatLng(e.latlng).setRadius(200)
      }
    }

    function onLocationError (e) {
      console.log(e)
    }

    map.on('locationfound', onLocationFound)
    map.on('locationerror', onLocationError)
    map.on('stopfollowing', function (e) {
      if (circle !== undefined) {
        circle.setRadius(0)
      }
    })

    component.button = function () {
      if (arguments.length === 1) {
        button = arguments[0]
        return component
      }
      if (button === undefined) {
        button = L.control.locate({
          icon: 'fa fa-map-marker',
          iconLoading: 'fa fa-spinner fa-spin',
          drawCircle: false,
          follow: true,
          onLocationError: onLocationError,
          locateOptions: settings
        })
      }
      return button
    }

    component.start = function () {
      component.button().start()
    }

    component.stop = function () {
      component.button().stop()
    }

    component.mapButton = function () {
      return function () {
        var map = this
        component.button().addTo(map)
      }
    }

    return component
  }
  var locator = userLocator(map)

  function aboutModal (locator, s) {
    var settings = s || {}
    var component = {}

    var $overlay = $('<div id="overlay"></div>')
    var $modal = $('#modal')
    var $content = $('#content')
    var $close = $('<a id="close" href="#">close</a>')
    var $showNextTime = $('<label id="showNextTime"><input type="checkbox"></input>下次顯示這個訊息</label>')
    var $locator = $('<a id="locator" href="#">顯示我的位置</a>')

    $modal.hide()
    $overlay.hide()
    $modal.append($content, $close, $locator, $showNextTime)

    component.mount = function () {
      $('body').append($overlay, $modal)
    }

    component.center = function () {
      var top, left
      top = Math.max($(window).height() - $modal.outerHeight(), 0) / 2
      left = Math.max($(window).width() - $modal.outerWidth(), 0) / 2
      $modal.css({
        top: top + $(window).scrollTop(),
        left: left + $(window).scrollLeft()
      })
    }

    component.open = function () {
      $('.leaflet-control').css('display', 'none')
      $modal.css({
        width: settings.width || 'auto',
        height: settings.height || 'auto'
      })
      component.center()
      $(window).bind('resize.modal', component.center)
      $modal.show()
      $overlay.show()
    }

    component.close = function () {
      $('.leaflet-control').css('display', 'inherit')
      $modal.hide()
      $overlay.hide()
      $(window).unbind('resize.modal')
    }

    $close.click(function (e) {
      e.preventDefault()
      component.close()
    })

    $locator.click(function (e) {
      e.preventDefault()
      locator.start()
      component.close()
    })

    $showNextTime.click(function (e) {
      window.localStorage.showNextTime = $(this).children()[0].checked
    })

    component.showNextTime = function () {
      return window.localStorage.showNextTime === undefined || window.localStorage.showNextTime === 'true'
    }

    $showNextTime.children()[0].checked = component.showNextTime()

    component.mapButton = function (settings) {
      return function () {
        var map = this
        function onClick (e) {
          component.open()
        }
        L.easyButton('fa fa-question-circle', onClick, '關於飲水地圖', map)
      }
    }

    return component
  }
  var about = aboutModal(locator, {
    width: screenSize() === 'large' ? $(window).width() / 1.5 : $(window).width() / 1.1
  })

  function osmLayer () {
    var attr_osm = '地圖資料 &copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
    return new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      opacity: 0.7,
      maxZoom: 18,
      attribution: attr_osm
    })
  }

  function waterDropIcon () {
    return L.icon({
      iconUrl: 'waterdrop.png',
      iconSize: [29, 40],
      iconAnchor: [15, 40],
      popupAnchor: [1, -20]
    })
  }

  function drinkingWaterLayer () {
    return function () {
      var map = this
      var l = new L.OverPassLayer({
        query: 'area(3600449220)->.searchArea;(node["amenity"="drinking_water"](area.searchArea);node["drinking_water"="yes"](area.searchArea);way["amenity"="drinking_water"](area.searchArea);way["drinking_water"="yes"](area.searchArea);rel["amenity"="drinking_water"](area.searchArea);rel["drinking_water"="yes"](area.searchArea););out;',
        callback: function (data) {
          for (var i = 0; i < data.elements.length; i++) {
            var e = data.elements[i]
            if (e.id in this.instance._ids) return
            e.tags.name = e.tags.name || '飲水機'
            e.tags.level = e.tags.level ? (+e.tags.level < 0 ? '地下 ' + -e.tags.level : e.tags.level) + ' 樓' : undefined
            this.instance._ids[e.id] = true
            var pos = new L.LatLng(e.lat, e.lon)
            var popup = '<div>' +
              '<div class="name">' + e.tags.name + '</div>' +
              '<div class="water">' +
              (e.tags.iced_water ? '<img src="iced.png"/>' : '') +
              (e.tags.cold_water ? '<img src="cold.png"/>' : '') +
              (e.tags.warm_water ? '<img src="warm.png"/>' : '') +
              (e.tags.hot_water ? '<img src="hot.png"/>' : '') +
              '</div>' +
              (e.tags.description ? '<div class="description">' + e.tags.description + '</div>' : '') +
              (e.tags.level ? '<div class="level">' + e.tags.level + '</div>' : '') +
              '</div>'
            var marker = L.marker(pos, {
              icon: waterDropIcon(),
              fillColor: '#fa3',
              fillOpacity: 0.5
            })
              .bindPopup(popup)
            this.instance.addLayer(marker)
          }
        },
        minZoomIndicatorOptions: {
          position: 'topright',
          minZoomMessageNoLayer: '',
          minZoomMessage: ''
        }
      })
      map.addLayer(l)
    }
  }

  map
    .addLayer(osmLayer())
    .on('load', drinkingWaterLayer())
    .on('load', locator.mapButton())
    .on('load', about.mapButton())
    .on('load', (function () {
      return function () {
        L.control.graphicScale({
          fill: 'hollow',
          imperial: false,
          updateWhenIdle: true
        }).addTo(this)
      }
    })())
    .on('load', function () {
      if (about.showNextTime()) {
        about.open()
      }
      if (!about.showNextTime()) {
        locator.start()
      }
    })

  function onReady () {
    about.mount()
    map
      .setView(new L.LatLng(25.0003133, 121.5388148), 15)
  }
  $(document).ready(onReady)
})($, L)