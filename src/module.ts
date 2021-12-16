import { KairosDBConfigCtrl } from './core/config_ctrl';
import { KairosDBDatasource } from './core/datasource';
import { KairosDBQueryCtrl } from './core/query_ctrl';

class KairosDBQueryOptionsCtrl {
  static templateUrl = 'partials/query.options.html';
}

export {
  KairosDBDatasource as Datasource,
  KairosDBQueryCtrl as QueryCtrl,
  KairosDBConfigCtrl as ConfigCtrl,
  KairosDBQueryOptionsCtrl as QueryOptionsCtrl,
};
