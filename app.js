(function ($, L) {
  function screenSize () {
    return $(window).width() > 600 ? 'large' : 'small'
  }

  var permalink = (function () {
    var permalink = {}
    var s = {
      lat: undefined,
      lng: undefined,
      zoom: undefined
    }
    permalink.load = function (loc) {
      var m = loc.hash.match(/^#map=(\d+)\/([\d\.]+)\/([\d\.]+)$/)
      if (m !== null) {
        s.zoom = m[1]
        s.lat = m[2]
        s.lng = m[3]
      }
    }
    permalink.dumps = function () {
      if (s.lat === undefined || s.lng === undefined || s.zoom === undefined) {
        return ''
      }
      return '#map=' + s.zoom + '/' + s.lat + '/' + s.lng
    }
    ;['zoom', 'lat', 'lng'].forEach(function (n) {
      permalink[n] = function () {
        if (arguments.length > 0) {
          s[n] = arguments[0]
        }
        return s[n]
      }
    })
    return permalink
  })()

  var map = new L.Map('map')
  var notes = notesLayer()

  var mapControl = (function () {
    var component = {}
    component.show = function () {
      $('.leaflet-control').css('display', 'inherit')
    }
    component.hide = function () {
      $('.leaflet-control').css('display', 'none')
    }
    return component
  })()

  var loading = (function (mapControl, s) {
    var settings = s || { image: 'reload.svg' }
    var component = {}
    var $overlay = $('<div class="app loading overlay"></div>')
    var $loading = $('<div class="app loading container"><img src="' + settings.image + '"></div>')

    component.mount = function () {
      component.close()
      $('body').append($overlay, $loading)
    }

    component.open = function () {
      mapControl.hide()
      $overlay.show()
      $loading.show()
    }

    component.close = function () {
      mapControl.show()
      $overlay.hide()
      $loading.hide()
    }

    return component
  })(mapControl, {
    image: 'reload.svg'
  })

  var modal = (function (mapControl, screenSize) {
    var settings = {
      width: screenSize() === 'large' ? $(window).width() / 1.5 : $(window).width() / 1.1,
      height: screenSize() === 'large' ? 'auto' : $(window).height() / 1.1
    }
    var component = {}
    var $overlay = $('<div class="app modal overlay"></div>')
    var $modal = $('<div class="app modal container"></div>')
    var $content = $('<div class="app modal content"></div>')
    var $close = $('<a class="app modal close" href="#">close</a>')

    component.mount = function () {
      component.close()
      $modal.append($close, $content)
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

    component.open = function (content) {
      mapControl.hide()
      $modal.css({
        width: settings.width || 'auto',
        height: settings.height || 'auto'
      })
      $content.append(content)
      component.center()
      $(window).bind('resize.modal', component.center)
      $modal.show()
      $overlay.show()
    }

    component.close = function () {
      mapControl.show()
      $modal.hide()
      $overlay.hide()
      $(window).unbind('resize.modal')
      $content.children().remove()
    }

    component.scroll = $content.scroll.bind($content)

    $overlay.click(function (e) {
      e.preventDefault()
      component.close()
    })

    $close.click(function (e) {
      e.preventDefault()
      component.close()
    })

    return component
  })(mapControl, screenSize)

  var addStation = (function (map, modal, loading, screenSize) {
    var component = {}
    var $dialog = $('<div class="app add-station dialog"></div>')
    var $overlay = $('<div class="app add-station dialog overlay"></div>')
    var $add = $('<button class="ui primary button">加</button>')
    var $cancel = $('<button class="ui button">取消</button>')
    var $submit = $('<button class="ui submit primary button">送出</button>')
    var $anchor = $('<i class="add-station anchor"></i>')
    var $close = $('<a class="app dialog close" href="#">close</a>')
// 開放時間
// 對外開放 是 否 不確定 需要許可
    var $fieldName = $('<div class="field"><label>名稱</label><input name="name" placeholder="建議使用讓別人一目瞭然的名稱" type="text"></div>')
    var $fieldDescription = $('<div class="field"><label>飲水點說明</label><input name="description" placeholder="請說明飲水點位置、如何找到它等資訊" type="text"></div>')
    var $fieldAddress = $('<div class="field"><label>地址</label><input name="address" placeholder="" type="text"></div>')
    var $fieldOpeningHours = $('<div class="field"><label>開放時間</label><input name="opening_hours" placeholder="如果有限制開放時間，請註明禮拜幾開放、幾點到幾點開放" type="text"></div>')
    var $fieldAccess = $('<div class="inline fields"><label>對外開放</label>' +
      '<div class="field"><div class="ui radio checkbox"><input name="access" type="radio" value="yes" checked="checked"><label>是</label></div></div>' +
      '<div class="field"><div class="ui radio checkbox"><input name="access" type="radio" value="no"                   ><label>否</label></div></div>' +
      '<div class="field"><div class="ui radio checkbox"><input name="access" type="radio" value="permissive"           ><label>需許可</label></div></div>' +
      '<div class="field"><div class="ui radio checkbox"><input name="access" type="radio" value="unknown"              ><label>不確定</label></div></div>' +
      '</div>')
    var $fieldTemperature = $('<div class="inline fields"><label>水溫</label>' +
      '<div class="field"><div class="ui checkbox"><input name="iced" value="iced" type="checkbox"><label>冰</label></div></div>' +
      '<div class="field"><div class="ui checkbox"><input name="cold" value="cold" type="checkbox"><label>冷</label></div></div>' +
      '<div class="field"><div class="ui checkbox"><input name="warm" value="warm" type="checkbox"><label>溫</label></div></div>' +
      '<div class="field"><div class="ui checkbox"><input name="hot"  value="hot"  type="checkbox"><label>熱</label></div></div>' +
      '</div>')
    var $fieldIndoor = $('<div class="inline fields"><label>位置</label>' +
      '<div class="field"><div class="ui radio checkbox"><input name="indoor" type="radio" value="yes" checked="checked"><label>室內</label></div></div>' +
      '<div class="field"><div class="ui radio checkbox"><input name="indoor" type="radio" value="no"                   ><label>室外</label></div></div>' +
      '</div>')
    var $fieldLevel = $('<div class="inline fields"><label>樓層</label>' +
      '<div class="field"><select class="ui search selection dropdown"><option value="-5">B5</option><option value="-4">B4</option><option value="-3">B3</option><option value="-2">B2</option><option value="-1">B1</option><option value="0">GF</option><option value="1" selected="selected">1F</option><option value="2">2F</option><option value="3">3F</option><option value="4">4F</option><option value="5">5F</option><option value="6">6F</option><option value="7">7F</option><option value="8">8F</option><option value="9">9F</option><option value="10">10F</option></select></div>' +
      '</div>')
    var $fieldOperator = $('<div class="field"><label>管理者</label><input name="operator" placeholder="負責人、負責單位" type="text"></div>')
    var $fieldBrand = $('<div class="field"><label>機型</label><input name="brand" placeholder="飲水機廠牌、機型" type="text"></div>')
    var $fieldPrecise = $('<div class="field"><div class="ui slider checkbox"><input name="precise" type="checkbox"><label>這個資訊是準確的</label></div></div>')
    var opened = false
    var point

    component.mount = function () {
      $overlay.hide()
      $dialog.hide()
      $('body').append($overlay, $dialog)
    }
    component.open = function (opt) {
      console.log(map.getZoom())
      if (map.getZoom() < 18) {
        window.alert('請放大到能清楚識別建物後，再行定位飲水點。')
        return
      }
      point = opt.containerPoint
      if (opened) return
      component.close()
      $add.click(function (e) {
        e.preventDefault()
        component.fillData()
      })
      $cancel.click(function (e) {
        e.preventDefault()
        component.close()
      })
      $close.click(function (e) {
        e.preventDefault()
        component.close()
      })

      $dialog.append(
        $close,
        $anchor,
        $('<div class="add-station content ui form"><h4>加一個飲水點？</h4></div>')
        .append($add, $cancel, '<p>請儘量提供完整訊息，以協助社群驗證資料正確性。</p>')
      )
      component.pointTo(point.x, point.y)
      $dialog.show()
      opened = true
    }
    component.close = function () {
      $dialog.children().remove()
      $dialog.removeClass('tl tr bl br')
      $dialog.hide()
      opened = false
    }
    component.pointTo = function (x, y) {
      var leftRightThreshhold = Math.floor($(window).width() / 2)
      var topBottomThreshold = Math.max($dialog.outerHeight(), ($(window).height() * 1 / 5))
      var direction = (y < topBottomThreshold ? 'b' : 't') + (x < leftRightThreshhold ? 'r' : 'l')
      $dialog.addClass(direction)
      if (screenSize() === 'small')  {
        $dialog.css({
          top: (direction[0] === 'b' ? y : y - $dialog.outerHeight()),
          left: 8,
          right: 8
        })
        $anchor.css({
          left: x - 8 - 15, // 8 (container spacing) + 15 (icon width/2)
          zIndex: 10
        })
      } else {
        var xx =  x - $dialog.outerWidth() < 0 ? 0 : x - $dialog.outerWidth()
        $dialog.css({
          top: (direction[0] === 'b' ? y : y - $dialog.outerHeight()),
          left: (direction[1] === 'r' ? x : xx),
          maxWidth: 300
        })
        if (x - $dialog.outerWidth() < 0) {
          $anchor.css({
            right: $dialog.outerWidth() - x,
            zIndex: 10
          })
        }
      }
    }
    component.fillData = function () {
      component.close()
      $submit.click(function (e) {
        e.preventDefault()
        component.submit()
      })
      $cancel.click(function (e) {
        e.preventDefault()
        modal.close()
      })
      var $content = $('<form class="app add-station ui form"></form>')
      $content.append(
        $fieldName, $fieldDescription, $fieldAddress, $fieldOpeningHours,
        $fieldAccess, $fieldTemperature, $fieldIndoor, $fieldLevel,
        $fieldOperator, $fieldBrand, $fieldPrecise)
      $content.append($submit, $cancel)
      modal.open($content)
    }
    component.submit = function () {
      modal.close()
      loading.open()
      var latLng = map.containerPointToLatLng(point)
      var noteText = '#飲水地圖 #drinking_water\n' +
        '名稱：' + $fieldName.children('input')[0].value + '\n' +
        '說明：' + $fieldDescription.children('input')[0].value + '\n' +
        '地址：' + ($fieldAddress.children('input')[0].value ? 'addr:full=' + $fieldAddress.children('input')[0].value : '') + '\n' +
        '開放時間：' + $fieldOpeningHours.children('input')[0].value + '\n' +
        '對外開放：access=' + $fieldAccess.find('input').map(function () { return $(this).prop('checked') ? $(this).val() : null }).toArray().join(' ') + '\n' +
        '溫度：' + $fieldTemperature.find('input').map(function () {
          return $(this).prop('checked') ? $(this).val() + '_water=yes' : null
        }).toArray().join(' ') + '\n' +
        '位置：' + $fieldIndoor.find('input').map(function () {
          return $(this).prop('checked') ? $(this).prop('name') + '=' + $(this).val() : null
        }).toArray().join(' ') + '\n' +
        '樓層：' + $fieldLevel.find('option').map(function () {
          return $(this).prop('selected') ? $(this).val() : null
        }).toArray().join(' ') + '\n' +
        '管理者：' + ($fieldOperator.children('input')[0].value ? 'operator=' + $fieldOperator.children('input')[0].value : '') + '\n' +
        '機型：' + ($fieldBrand.children('input')[0].value ? 'brand=' + $fieldBrand.children('input')[0].value : '') + '\n' +
        '精確：' + $fieldPrecise.find('input').map(function () {
          return $(this).prop('checked') ? 'yes' : 'no'
        }).toArray().join(' ')
      $.post('https://api.openstreetmap.org/api/0.6/notes.json?lat=' + latLng.lat + '&lon=' + latLng.lng + '&text=' + encodeURIComponent(noteText), '', function (data, ok, ajax) {
        loading.close()
        var $content = $('<form class="app add-station ui form"><h4>資料已上傳至開放街圖</h4><p><a href="https://www.openstreetmap.org/#map=18/' + data.geometry.coordinates[1] + '/' + data.geometry.coordinates[0] + '" target="_blank">開放街圖</a>是自由而且開源的全球地圖，由像你一樣的使用者所繪製。如果你願意協助編輯<a href="https://www.openstreetmap.org/note/' + data.properties.id + '" target="_blank">剛才新增的飲水點資料</a>，可參考開放街圖社群所提供的 <a href="https://osmtw.hackpad.com/Note-5FCtyE3QsJE" target="_blank">Note 編修說明書</a>。</p></form>')
        var $ok = $('<button class="ui primary button">好</button>')
        $ok.click(function () {
          modal.close()
        })
        $content.append($ok)
        modal.open($content)
        notes.reload()
      })
    }
    return component
  })(map, modal, loading, screenSize)

  function userLocator (map, s) {
    var settings = s || {
      setView: true,
      maxZoom: 18,
      tap: true
    }
    var component = {}
    var button
    var circle

    function onLocationFound (e) {
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
    map.on('contextmenu', function (evt) {
      addStation.open(evt)
    })

    component.button = function () {
      if (arguments.length === 1) {
        button = arguments[0]
        return component
      }
      if (button === undefined) {
        button = L.control.locate({
          icon: 'fa fa-location-arrow',
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

  var about = (function (locator, modal) {
    var component = {}
    var $content = $('<div><div class="depr-announce">環境資訊協會原先發起的WaterGo專案及相關的飲水地圖維護已於2019/8/31停止(參見<a href="https://www.facebook.com/groups/1255977671181394/permalink/2245559418889876/">公告</a>)，如您仍對參與飲水地圖有興趣，可至臉書<a href="https://www.facebook.com/groups/1255977671181394">飲水地圖</a>社圖一同討論</div><hr/><div class="app about text"><p>一個600ml的瓶裝水，需要耗費600ml的6~7倍水量製造它的塑膠瓶！在缺水的時代來臨時，別再讓塑膠瓶跟我們搶水資源了！</p>' +
      '<p>自備環保杯是個絕佳的選擇，但是喝完自備的水後怎麼辦？</p>' +
      '<p>從現在開始，我們要讓帶環保杯的朋友，可以快速的找到補水地點，讓大家隨心所欲的喝水保健康。</p>' +
      '<p>此外，<a href="https://teia.tw/" target="_blank">台灣環境資訊協會</a>懇請大家，少喝瓶裝水，努力減少塑膠瓶及瓶蓋等海洋垃圾，減少海鳥、海龜、鯨豚…等海洋生物吞食這些塑膠垃圾而痛苦至死。您的努力，也將是他們活命的機會！</p>' +
      '<h4>使用說明</h4>' +
      '<ul><li>點選「顯示我的位置」可以把地圖捲動到你的所在地。</li>' +
      '<li>如果你知道這個地點有飲水機，但地圖上沒有，可以（在手機上）長按或（在電腦上）右鍵點擊該處，提供飲水點資料。</li>' +
      '<li>如果你有<a href="https://www.openstreetmap.org/" target="_blank">開放街圖</a>的帳號，歡迎參考這份<a href="https://docs.google.com/document/d/1by9-SqfJ6qvu0dGER4E63bKsvGp3LhoqK86XFHHM_JI/edit?usp=sharing" target="_blank">說明</a>，一起編輯飲水地圖。請見<a href="notes.html" target="_blank">飲水點資料列表</a>。</li>' +
      '</ul>' +
      '<h4>關於本計劃</h4>' +
      '<p>本計劃由<a href="https://teia.tw/" target="_blank">台灣環境資訊協會</a>發起，感謝<a href="https://www.openstreetmap.org/" target="_blank">開放街圖</a>與<a href="https://openstreetmap.tw/" target="_blank">台灣開放街圖社群</a>提供資料庫與技術支援。</p>' +
      '<p><a href="https://watergo.teia.tw/" target="_blank">計劃網站</a></p>' +
      '<p><a href="https://e-info.neticrm.tw/civicrm/contribute/transact?reset=1&id=9" target="_blank">捐款給台灣環境資訊協會</a></p>' +
      '<p><a href="https://ocf.neticrm.tw/civicrm/contribute/transact?reset=1&id=16" target="_blank">捐款給台灣開放街圖社群</a></p>' +
      '</div></div>')
    var $showNextTime = $('<div class="ui showNextTime checkbox"><input name="showNextTime" type="checkbox"><label>下次顯示</label></div>')
    var $locator = $('<div class="ui locator primary labeled icon button"><i class="map icon"></i>顯示我的位置</div>')
    var locatorShadow = {
      position: 'absolute',
      left: 8,
      bottom: 8,
      right: 4,
      boxShadow: '0px -20px 10px -5px #fff'
    }

    component.open = function () {
      $content.append($locator, $showNextTime)
      $showNextTime.children('input[type="checkbox"]')[0].checked = component.willShowNextTime()
      $showNextTime.click(function (e) {
        window.localStorage.showNextTime = $(this).children('input[type="checkbox"]')[0].checked
      })
      if (screenSize() === 'small') {
        $locator.css(locatorShadow)
        modal.scroll(function () {
          if ($(this).scrollTop() === 0) {
            $locator.css(locatorShadow)
          } else {
            $locator.css({
              position: 'inherit',
              boxShadow: 'none'
            })
          }
        })
      }
      $locator.click(function (e) {
        e.preventDefault()
        locator.start()
        component.close()
      })
      modal.open($content)
    }
    component.close = modal.close

    component.mapButton = function (settings) {
      return function () {
        var map = this
        function onClick (e) {
          component.open()
        }
        L.easyButton('fa fa-question-circle', onClick, '關於飲水地圖', map)
      }
    }

    component.willShowNextTime = function () {
      return window.localStorage.showNextTime === undefined || window.localStorage.showNextTime === 'true'
    }

    return component
  })(locator, modal)

  function osmLayer () {
    var attr_osm = '地圖資料 &copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
    return new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      opacity: 0.7,
      maxZoom: 18,
      attribution: attr_osm
    })
  }

  function waterDropIcon (color) {
    if (color === undefined) {
      color = ''
    }
    return L.icon({
      iconUrl: 'waterdrop' + color + '.png',
      iconSize: [29, 40],
      iconAnchor: [15, 40],
      popupAnchor: [1, -20]
    })
  }

  function notesLayer () {
    var map
    var layer
    function displayNote (feature) {
      var text = feature.properties.comments[0].text
      var v = {}
      text.split('\n')
        .filter(function (l) { return l.search('：') >= 0 })
        .map(function (l) { return l.split('：') })
        .forEach(function (x) {
          v[x[0]] = x[1]
        })
      return '<div>' +
        '<div class="unverified ui label"><i class="info icon"></i>未驗證</div>' +
        '<div><a href="https://www.openstreetmap.org/note/' + feature.properties.id + '" target="_blank">這個資訊正確嗎？</a></div>' +
        '<div class="name">' + (v['名稱'] || '') + '</div>' +
        (v['溫度'] ? (
          '<div class="water">' +
            (v['溫度'].search('iced_water') >= 0 ? '<img src="iced.png"/>' : '') +
            (v['溫度'].search('cold_water') >= 0 ? '<img src="cold.png"/>' : '') +
            (v['溫度'].search('warm_water') >= 0 ? '<img src="warm.png"/>' : '') +
            (v['溫度'].search('hot_water') >= 0  ? '<img src="hot.png"/>' : '') +
          '</div>') : '') +
        (v['說明'] ? '<div class="description">' + v['說明'] + '</div>' : '') +
        (v['樓層'] ? '<div class="level">' + (v['樓層'] < 0 ? '地下 ' + -v['樓層'] : v['樓層']) + ' 樓' + '</div>' : '') +
        (v['管理者'] ? '<div class="operator">管理者：' + v['管理者'].replace(/operator=/, '') + '</div>' : '') +
        (v['機型'] ? '<div class="brand">機型：' + v['機型'].replace(/brand=/, '') + '</div>' : '') +
        '</div>'
    }
    function draw () {
      map = this
      draw.reload()
    }
    draw.reload = function () {
      if (layer === undefined) {
        layer = L.layerGroup()
      }
      layer.clearLayers()
      $.get('https://api.openstreetmap.org/api/0.6/notes/search.json?q=%E9%A3%B2%E6%B0%B4%E5%9C%B0%E5%9C%96', function (data, ok, ajax) {
        data.features
          .filter(function (feature) { return feature.properties.status === 'open' })
          .forEach(function (feature) {
            var marker = L.marker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
              icon: waterDropIcon('green'),
            }).bindPopup(displayNote(feature))
            marker.addTo(layer)
          })
        layer.addTo(map)
      })
    }
    return draw
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
              (e.tags['drinking_water:iced_water'] ? '<img src="iced.png"/>' : '') +
              (e.tags['drinking_water:cold_water'] ? '<img src="cold.png"/>' : '') +
              (e.tags['drinking_water:warm_water'] ? '<img src="warm.png"/>' : '') +
              (e.tags['drinking_water:hot_water'] ? '<img src="hot.png"/>' : '') +
              (e.tags.iced_water ? '<img src="iced.png"/>' : '') +
              (e.tags.cold_water ? '<img src="cold.png"/>' : '') +
              (e.tags.warm_water ? '<img src="warm.png"/>' : '') +
              (e.tags.hot_water ? '<img src="hot.png"/>' : '') +
              '</div>' +
              (e.tags.description ? '<div class="description">' + e.tags.description + '</div>' : '') +
              (e.tags.level ? '<div class="level">' + e.tags.level + '</div>' : '') +
              (e.tags.operator ? '<div class="operator">管理者：' + e.tags.operator + '</div>' : '') +
              (e.tags.brand ? '<div class="brand">機型：' + e.tags.brand + '</div>' : '') +
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
    .on('load', notes)
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
      if (permalink.dumps()) {
        return
      }
      if (about.willShowNextTime()) {
        about.open()
      } else {
        locator.start()
      }
    })
    .on('moveend', function (e) {
      permalink.lat(map.getCenter().lat)
      permalink.lng(map.getCenter().lng)
      window.location.hash = permalink.dumps()
    })
    .on('zoomend', function (e) {
      permalink.zoom(map.getZoom())
      window.location.hash = permalink.dumps()
    })

  function appStart () {
    permalink.load(window.location)
    loading.mount()
    modal.mount()
    addStation.mount()
    if (permalink.dumps() !== '') {
      map
        .setView(new L.LatLng(permalink.lat(), permalink.lng()), permalink.zoom())
    } else {
      map
        .setView(new L.LatLng(25.0003133, 121.5388148), 15)
    }
  }
  $(document).ready(appStart)
})($, L)
