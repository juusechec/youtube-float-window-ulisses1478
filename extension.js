// Copyright (c) Ulisses 2019
// License: MIT
// Modified by @juusechec
// based on: https://wiki.gnome.org/Projects/GnomeShell/Extensions/EcoDoc/Applet
const Meta = imports.gi.Meta;
const Lang = imports.lang;
const Main = imports.ui.main;

const GObject = imports.gi.GObject;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

const St = imports.gi.St;

let hoppingWindow = null;

function init(em) {
  hoppingWindow = new HoppingWindow(em);
  return hoppingWindow;
}

function HoppingWindow(em) {
  this.corner = 2;
  this.size = 350;
  this.statusEnabled = false;
}

const MyMenu_Indicator = new Lang.Class({
  Name: 'MyMenu.indicator',
  Extends: PanelMenu.Button,

  _init: function () {
    this.parent(0.0);

    const icon = new St.Icon({
      icon_name: 'system-lock-screen',
      style_class: 'system-status-icon example-icon'
    });

    this.actor.add_child(icon);

    const menuItem = new PopupMenu.PopupMenuItem('Enable/Disable');
    menuItem.actor.connect('button-press-event', function () {
      const enabled = hoppingWindow.changeEnabled();
      Main.notify('Youtube Popup', enabled ? 'Enabled!': 'Disabled!');
      hoppingWindow.try_spawn(0);
    });
    this.menu.addMenuItem(menuItem);

    //const item2 = new PopupMenu.PopupBaseMenuItem({ activate: false });
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/master/js/ui/popupMenu.js
    const item2 = new PopupMenu.PopupMenuItem('Size: ');
    this.menu.addMenuItem(item2);

    // https://github.com/kiyui/gnome-shell-night-light-slider-extension/blob/master/night-light-slider.timur%40linux.com/extension.js
    const slider = new Slider.Slider(1);
    slider.connect('notify::value', function() {
      global.log('value', slider.value);
      const max = 550;
      const min = 100;
      const newValue = Math.floor(slider.value * (max - min + 1) + min);
      hoppingWindow.size = newValue;
      hoppingWindow.try_spawn();
    });
    slider.accessible_name = 'Temperature';
    item2.add(slider);
   
  }
});

HoppingWindow.prototype = {
  changeEnabled: function () {
    this.statusEnabled = !this.statusEnabled;
    return this.statusEnabled;
  },
  enable: function () {
    this.workspaceSwitchSignal = global.workspace_manager.connect('workspace-switched', Lang.bind(this, this.try_spawn));
    this._indicator = new MyMenu_Indicator();
    const positionIndexJorge = 5;
    Main.panel._addToPanelBox('MyMenu', this._indicator, positionIndexJorge, Main.panel._leftBox);
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/panel.js#L462
    // https://github.com/julio641742/gnome-shell-extension-reference/blob/master/REFERENCE.md#panelmenujs
    // Main.panel._addToPanelBox('MyMenu', this._indicator, 1, Main.panel._rightBox);
  },
  disable: function () {
    this.despawn_window();
    global.workspace_manager.disconnect(this.workspaceSwitchSignal);
    this._indicator.destroy();
  },
  try_spawn: function () {
    this.despawn_window();
    if (!this.statusEnabled) {
      return;
    }
    let target = this.find_window('!important') ||
                 this.find_window('Teams') ||
                 this.find_window('Platzi') ||
                 this.find_window('YouTube') ||
                 this.find_window('Anime') ||
                 this.find_window('Online');
    if (target) {
      this.spawn_window(target);
    }
  },
  find_window: function (title) {
    let workspaces_count = global.workspace_manager.n_workspaces;
    // global.log('workspaces_count', workspaces_count);

    let active_workspace_index = global.workspace_manager.get_active_workspace_index();
    // global.log('active_workspace_index', active_workspace_index);

    for (let i = 0; i < workspaces_count; i++) {
      if (i != active_workspace_index) {
        let workspace = global.workspace_manager.get_workspace_by_index(i);

        const window = this.find_window_in_workspace(workspace, title);
        if (window) {
          return window;
        }
      }
    }
  },
  find_window_in_workspace: function (workspace, title) {
    let windows = workspace.list_windows();
    // global.log('windows.length', windows.length);
    for (let i in windows) {
      // global.log('windows[i]', windows[i], windows[i].get_title());
      if (windows[i].get_title().search(title) > -1) {
        return windows[i];
      }
    }
  },
  despawn_window: function () {
    if (!this.preview) {
      return;
    }

    this.preview.destroy();
    this.preview = null;
  },
  spawn_window: function (win) {
    this.despawn_window();

    this.preview = new imports.gi.St.Button({
      style_class: 'youtube-preview'
    });
    let th = this.generate_texture(win, this.size);
    this.preview.add_actor(th);

    function increment(i) {
      return i + 1;
    }

    let event = Lang.bind(this, _ => this.switchCorner(increment));
    this.preview.connect('enter-event', event);
    this.switchCorner();

    Main.layoutManager.addChrome(this.preview);
  },
  generate_texture: function (win, size) {
    let mutw = win.get_compositor_private();

    if (!mutw) {
      return;
    }
    
    let framerect = win.get_frame_rect();
    let width = framerect.width;
    let height = framerect.height;
    let scale = Math.min(1.0, size / width, size / height);

    let th = new imports.gi.Clutter.Clone({
      source: mutw,
      reactive: true,
      width: width * scale,
      height: height * scale
    });

    return th;
  }
}

HoppingWindow.prototype.switchCorner = function (increment) {
  if (typeof increment == 'function') {
    this.corner = increment(this.corner) % 4
  }

  let g = Main.layoutManager.getWorkAreaForMonitor(0);

  let border_size = 0;

  let drawable_rect = [
    g.x, g.y, g.x + g.width - this.preview.get_width(), g.y + g.height - this.preview.get_height(),
  ];

  let points = [
    [
      drawable_rect[0], drawable_rect[1],
    ],
    [
      drawable_rect[0], drawable_rect[3],
    ],
    [
      drawable_rect[2] - 0, 0,
    ],
    [
      drawable_rect[2], drawable_rect[3],
    ],
  ];

  // global.log('corner: ' + this.corner);

  this.posX = points[this.corner][0];
  this.posY = points[this.corner][1];

  // global.log('position_x: ' + this.posX + ', position_y: ' + this.posY);

  this.preview.set_position(this.posX, this.posY);
};
