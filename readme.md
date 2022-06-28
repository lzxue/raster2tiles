## tiff 切片工具
- 目前支持单波段数据切片
- 单个数据切片
- 仅支持 3857 切片,如果不是需要自行转换

### 
 []多个数据切片，相同瓦片数据合并
 []支持坐标转换
 []支持多波段

 ## 使用

 ```
 npm install -g rastertile

 ```
### 
 -s 输入数据路径
 -o 输出数据路径
 -z 切片最小等级
 -Z 切片最大等级

 ```bash
 rastertile  -s ./src/landcover.tiff -o ./tile -z 0 -Z 5
 ```



